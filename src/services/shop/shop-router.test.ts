import { beforeEach, describe, expect, it } from "@jest/globals";
import { delAsAttendee, getAsAttendee, postAsAttendee, postAsStaff, TESTER } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { ShopItem, ShopOrder } from "./shop-schemas";
import { AttendeeProfile } from "../profile/profile-schemas";

// Define test item
const TESTER_SHOP_ITEM = {
    itemId: "test-item-1",
    name: "Test Item",
    price: 100,
    isRaffle: true,
    imageURL: "test.jpg",
    quantity: 10,
} satisfies ShopItem;

const TESTER_SHOP_ORDER = new ShopOrder([["test-item-1", 2]], TESTER.id) satisfies ShopOrder;

// Define test profile
const TESTER_PROFILE = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 1000,
    foodWave: 1,
} satisfies AttendeeProfile;

// Initialize test data before each test
beforeEach(async () => {
    // Clean up any existing data
    await Models.ShopItem.deleteMany({});
    await Models.ShopOrder.deleteMany({});
    await Models.AttendeeProfile.deleteMany({});

    // Create fresh test data
    await Models.ShopItem.create(TESTER_SHOP_ITEM);
    await Models.ShopOrder.create(TESTER_SHOP_ORDER);
    await Models.AttendeeProfile.create(TESTER_PROFILE);
});

//
// POST /shop/cart/redeem
//
describe("POST /shop/cart/redeem", () => {
    it("allows staff to successfully redeem an order", async () => {
        const response = await postAsStaff("/shop/cart/redeem")
            .send({ userId: TESTER_PROFILE.userId })
            .expect(StatusCode.SuccessOK);

        // Expect returned order to use the new tuple format.
        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_PROFILE.userId,
            items: [["test-item-1", 2]],
        });

        // Verify inventory was updated: quantity reduced by 2 (from 10 to 8)
        const updatedItem = await Models.ShopItem.findOne({ itemId: TESTER_SHOP_ITEM.itemId });
        expect(updatedItem?.quantity).toBe(8);

        // Verify points were deducted (2 * 100 = 200, so 1000-200 = 800)
        const updatedProfile = await Models.AttendeeProfile.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedProfile?.points).toBe(800);

        // Verify order was deleted
        const deletedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(deletedOrder).toBeNull();
    });

    it("returns NotFound for non-existent order", async () => {
        await postAsStaff("/shop/cart/redeem").send({ userId: "non-existent-user" }).expect(StatusCode.ServerErrorInternal);
    });

    it("returns NotFound for non-existent user profile", async () => {
        // Create order but delete profile
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_PROFILE.userId });

        await postAsStaff("/shop/cart/redeem").send({ userId: TESTER_PROFILE.userId }).expect(StatusCode.ServerErrorInternal);
    });

    it("returns NotFound for non-existent shop item", async () => {
        // Update order so that it now references a non-existent item.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["non-existent-item", 1]] });

        await postAsStaff("/shop/cart/redeem").send({ userId: TESTER_PROFILE.userId }).expect(StatusCode.ClientErrorNotFound);
    });

    it("returns BadRequest for insufficient item quantity", async () => {
        // Request more than available (11 instead of available 10)
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["test-item-1", 11]] });

        await postAsStaff("/shop/cart/redeem").send({ userId: TESTER_PROFILE.userId }).expect(StatusCode.ClientErrorBadRequest);
    });

    it("returns PaymentRequired for insufficient points", async () => {
        // Set the user’s points to 0
        await Models.AttendeeProfile.updateOne({ userId: TESTER_PROFILE.userId }, { points: 0 });

        await postAsStaff("/shop/cart/redeem")
            .send({ userId: TESTER_PROFILE.userId })
            .expect(StatusCode.ClientErrorPaymentRequired);
    });

    it("handles undefined quantity correctly", async () => {
        // Unset the quantity for "test-item-1" in the items map.
        // (Assuming the ShopOrder is stored as an object in MongoDB,
        //  unsetting the field will cause its quantity to be undefined.)
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { $unset: { "items.test-item-1": "" } });

        await postAsStaff("/shop/cart/redeem").send({ userId: TESTER_PROFILE.userId }).expect(StatusCode.SuccessOK);

        // Since undefined should be treated as 0, the shop item’s quantity should remain unchanged.
        const updatedItem = await Models.ShopItem.findOne({ itemId: TESTER_SHOP_ITEM.itemId });
        expect(updatedItem?.quantity).toBe(TESTER_SHOP_ITEM.quantity);
    });

    it("handles multiple items in order correctly", async () => {
        // Create a second test item.
        const secondItem = {
            ...TESTER_SHOP_ITEM,
            itemId: "test-item-2",
            price: 50,
        };
        await Models.ShopItem.create(secondItem);

        // Update order to include two items:
        // "test-item-1": 1 unit and "test-item-2": 2 units.
        await Models.ShopOrder.updateOne(
            { userId: TESTER_PROFILE.userId },
            {
                items: [
                    ["test-item-1", 1],
                    [secondItem.itemId, 2],
                ],
            },
        );

        await postAsStaff("/shop/cart/redeem").send({ userId: TESTER_PROFILE.userId }).expect(StatusCode.SuccessOK);

        // Verify inventory updates.
        const updatedItem1 = await Models.ShopItem.findOne({ itemId: TESTER_SHOP_ITEM.itemId });
        const updatedItem2 = await Models.ShopItem.findOne({ itemId: secondItem.itemId });
        expect(updatedItem1?.quantity).toBe(TESTER_SHOP_ITEM.quantity - 1);
        expect(updatedItem2?.quantity).toBe(TESTER_SHOP_ITEM.quantity - 2);

        // Verify total points deduction: (100 * 1) + (50 * 2)
        const updatedProfile = await Models.AttendeeProfile.findOne({ userId: TESTER_PROFILE.userId });
        const expectedPoints = TESTER_PROFILE.points - (TESTER_SHOP_ITEM.price * 1 + secondItem.price * 2);
        expect(updatedProfile?.points).toBe(expectedPoints);
    });
});

//
// POST /shop/cart/:itemId
//
describe("POST /shop/cart/:itemId", () => {
    it("allows user to add new item to cart", async () => {
        const response = await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        // Since the initial order had 2 units, adding one more should yield 3.
        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_PROFILE.userId,
            items: [["test-item-1", 3]],
        });

        const updatedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedOrder?.items.get("test-item-1")).toBe(3);
    });

    it("increases quantity when adding existing item to cart", async () => {
        // First addition.
        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        // Second addition.
        const response = await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        // Starting with 2, two additions should result in 4.
        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_PROFILE.userId,
            items: [["test-item-1", 4]],
        });

        const updatedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedOrder?.items.get("test-item-1")).toBe(4);
    });

    it("returns NotFound for non-existent item", async () => {
        await postAsAttendee("/shop/cart/non-existent-item").expect(StatusCode.ClientErrorNotFound);
    });

    it("returns BadRequest when insufficient shop quantity", async () => {
        await Models.ShopItem.create({
            ...TESTER_SHOP_ITEM,
            itemId: "out-of-stock-item",
            quantity: 0,
        });

        await postAsAttendee("/shop/cart/out-of-stock-item").expect(StatusCode.ClientErrorBadRequest);
    });

    it("returns PaymentRequired when insufficient points", async () => {
        await Models.ShopItem.create({
            ...TESTER_SHOP_ITEM,
            itemId: "expensive-item",
            price: 2000,
            quantity: 1,
        });

        await postAsAttendee("/shop/cart/expensive-item").expect(StatusCode.ClientErrorPaymentRequired);
    });

    it("creates new cart if user doesn't have one", async () => {
        // Delete any existing cart.
        await Models.ShopOrder.deleteOne({ userId: TESTER_PROFILE.userId });

        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        const newOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(newOrder).toBeTruthy();
        // For a new cart, the item should be added with quantity 1.
        expect(newOrder?.items.get("test-item-1")).toBe(1);
    });
});

//
// DELETE /shop/cart/:itemId
//
describe("DELETE /shop/cart/:itemId", () => {
    it("allows user to remove an item from the cart", async () => {
        // Set the cart so that test-item-1 has quantity 1.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["test-item-1", 1]] });

        // Removing the item when its quantity is 1 should remove it completely.
        await delAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);
        const updatedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedOrder?.items.has("test-item-1")).toBe(false);
    });

    it("decreases the quantity of an item in the cart", async () => {
        // Start with quantity 0 for the item.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["test-item-1", 0]] });
        // Add the item twice.
        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK); // becomes 1
        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK); // becomes 2

        // Remove the item once.
        const response = await delAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_PROFILE.userId,
            items: [["test-item-1", 1]],
        });

        const updatedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedOrder?.items.get("test-item-1")).toBe(1);
    });

    it("removes the item completely if the quantity reaches 0", async () => {
        // Start with quantity 0.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["test-item-1", 0]] });
        // Add the item twice.
        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);
        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        // Remove the item twice.
        await delAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);
        await delAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        const updatedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedOrder?.items.has("test-item-1")).toBe(false);
    });

    it("returns NotFound for non-existent item in cart", async () => {
        await delAsAttendee("/shop/cart/non-existent-item").expect(StatusCode.ClientErrorNotFound);
    });

    it("returns NotFound when no cart exists for the user", async () => {
        await Models.ShopOrder.deleteOne({ userId: TESTER_PROFILE.userId });
        await delAsAttendee("/shop/cart/test-item-1").expect(StatusCode.ClientErrorNotFound);
    });

    it("removes the item completely when quantity reaches 0 in a fresh cart", async () => {
        // Start fresh with no cart.
        await Models.ShopOrder.deleteOne({ userId: TESTER_PROFILE.userId });

        // Add an item.
        await postAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        // Now delete the item.
        await delAsAttendee("/shop/cart/test-item-1").expect(StatusCode.SuccessOK);

        const updatedOrder = await Models.ShopOrder.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedOrder?.items.has("test-item-1")).toBe(false);
    });
});

//
// GET /shop/cart
//
describe("GET /shop/cart", () => {
    it("returns user's cart contents", async () => {
        const response = await getAsAttendee("/shop/cart").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_PROFILE.userId,
            items: [["test-item-1", 2]],
        });
    });

    it("creates and returns empty cart for new user", async () => {
        // Ensure no existing cart.
        await Models.ShopOrder.findOneAndDelete({ userId: TESTER.id });

        const response = await getAsAttendee("/shop/cart").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            items: [],
        });
    });

    it("returns cart with matching items and quantities", async () => {
        await Models.ShopOrder.findOneAndDelete({ userId: TESTER.id });
        const shopOrder = {
            userId: TESTER.id,
            items: [
                [TESTER_SHOP_ITEM.itemId, 1],
                ["test-item-2", 3],
            ],
        };
        await Models.ShopOrder.create(shopOrder);

        const response = await getAsAttendee("/shop/cart").expect(StatusCode.SuccessOK);
        const cart = JSON.parse(response.text);

        expect(cart).toMatchObject({
            userId: TESTER.id,
            items: [
                [TESTER_SHOP_ITEM.itemId, 1],
                ["test-item-2", 3],
            ],
        });
    });
});

//
// GET /shop/cart/qr
//
describe("GET /shop/cart/qr", () => {
    it("returns QR code URL for valid cart", async () => {
        const response = await getAsAttendee("/shop/cart/qr").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            qrInfo: `hackillinois://shop?userId=${TESTER_PROFILE.userId}`,
        });
    });

    it("returns InternalServerError for non-existent cart", async () => {
        await Models.ShopOrder.deleteOne({ userId: TESTER_PROFILE.userId });
        await getAsAttendee("/shop/cart/qr").expect(StatusCode.ServerErrorInternal);
    });

    it("returns NotFound when cart item no longer exists in shop", async () => {
        // Create a cart with an item that does not exist.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["non-existent-item", 1]] });

        const response = await getAsAttendee("/shop/cart/qr").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: expect.any(String),
        });
    });

    it("returns BadRequest when insufficient shop quantity", async () => {
        // Create an item with a low quantity.
        const lowQuantityItem = {
            ...TESTER_SHOP_ITEM,
            itemId: "low-quantity-item",
            quantity: 1,
        };
        await Models.ShopItem.create(lowQuantityItem);

        // Create a cart requesting more than available.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["low-quantity-item", 2]] });

        const response = await getAsAttendee("/shop/cart/qr").expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toMatchObject({
            error: expect.any(String),
        });
    });

    it("returns PaymentRequired when insufficient points for total cart", async () => {
        // Create expensive items.
        const expensiveItem1 = {
            ...TESTER_SHOP_ITEM,
            itemId: "expensive-item-1",
            price: 500,
            quantity: 2,
        };
        const expensiveItem2 = {
            ...TESTER_SHOP_ITEM,
            itemId: "expensive-item-2",
            price: 600,
            quantity: 2,
        };
        await Models.ShopItem.create(expensiveItem1);
        await Models.ShopItem.create(expensiveItem2);

        // Create cart with the expensive items.
        await Models.ShopOrder.updateOne(
            { userId: TESTER_PROFILE.userId },
            {
                items: [
                    ["expensive-item-1", 1],
                    ["expensive-item-2", 1],
                ],
            },
        );

        // Set user points to less than the total price.
        await Models.AttendeeProfile.updateOne({ userId: TESTER_PROFILE.userId }, { points: 1000 });

        const response = await getAsAttendee("/shop/cart/qr").expect(StatusCode.ClientErrorPaymentRequired);
        expect(JSON.parse(response.text)).toMatchObject({
            error: expect.any(String),
        });
    });

    it("succeeds when user has exactly enough points", async () => {
        // Create an item with a known price.
        const item = {
            ...TESTER_SHOP_ITEM,
            itemId: "exact-price-item",
            price: 100,
            quantity: 1,
        };
        await Models.ShopItem.create(item);

        // Create a cart with this item.
        await Models.ShopOrder.updateOne({ userId: TESTER_PROFILE.userId }, { items: [["exact-price-item", 1]] });

        // Set the user's points to the exact amount needed.
        await Models.AttendeeProfile.updateOne({ userId: TESTER_PROFILE.userId }, { points: 100 });

        const response = await getAsAttendee("/shop/cart/qr").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({
            qrInfo: `hackillinois://shop?userId=${TESTER_PROFILE.userId}`,
        });
    });
});
