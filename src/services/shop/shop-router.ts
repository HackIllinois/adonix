import crypto from "crypto";
import { AttendeeProfile } from "database/attendee-db.js";
import { ShopItem } from "database/shop-db.js";
import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { StatusCode } from "status-code-enum";
import Config from "../../config.js";
import Models from "../../database/models.js";
import { RouterError } from "../../middleware/error-handler.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";
import { hasAdminPerms, hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { updateCoins } from "../profile/profile-lib.js";
import { FilteredShopItemFormat, isValidItemFormat } from "./shop-formats.js";

/**
 * @api {get} /shop GET /shop
 * @apiGroup Shop
 * @apiDescription Get item details for all items in point shop.
 *
 * @apiSuccess (200: Success) {Json} items The items details.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   [{
 *      "itemId": "item01",
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 15,
 *      "isRaffle": true,
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/hoodie.svg"
 *   }, {
 *      "itemId": "item02",
 *      "name": "Snack Pack!",
 *      "price": 20,
 *      "isRaffle": false,
 *      "quantity": 25,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/snack_pack.svg"
 *   }]
 * }
 *
 * @apiUse weakVerifyErrors
 * */

const shopRouter: Router = Router();
shopRouter.get("/", weakJwtVerification, async (_1: Request, res: Response, _2: NextFunction) => {
    const shopItems: ShopItem[] = await Models.ShopItem.find();

    const filteredData: FilteredShopItemFormat[] = shopItems.map((item: ShopItem) => ({
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        isRaffle: item.isRaffle,
        quantity: item.quantity,
        imageURL: item.imageURL,
    }));

    return res.status(StatusCode.SuccessOK).send(filteredData);
});

/**
 * @api {post} /shop/item POST /shop/item
 * @apiGroup Shop
 * @apiDescription Insert a new item into the shop.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody {Json} item The item details to be created.
 * @apiParamExample {Json} Request Body Example for an Item:
 * {
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 15,
 *      "isRaffle": true,
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
 * }
 *
 * @apiSuccess (200: Success) {Json} items The items details.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *      "itemId": "item01",
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 15,
 *      "isRaffle": true,
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} BadRequest Item passed with invalid format.
 * @apiError (400: Bad Request) {String} ItemAlreadyExists Item already exists in shop.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 * */
shopRouter.post("/item", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const itemFormat: ShopItem = req.body as ShopItem;
    if (!isValidItemFormat(itemFormat, false)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadRequest", itemFormat));
    }

    const itemId = "item" + parseInt(crypto.randomBytes(Config.SHOP_BYTES_GEN).toString("hex"), 16);
    const instances = Array.from({ length: itemFormat.quantity }, (_, index) => getRand(index));

    const shopItem: ShopItem = {
        itemId: itemId,
        name: itemFormat.name,
        price: itemFormat.price,
        isRaffle: itemFormat.isRaffle,
        imageURL: itemFormat.imageURL,
        quantity: itemFormat.quantity,
        instances: instances,
    };

    // Ensure that item doesn't already exist before creating
    const itemExists: boolean = (await Models.ShopItem.findOne({ name: itemFormat.name })) ?? false;
    if (itemExists) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ItemAlreadyExists"));
    }

    const newItem: ShopItem = await Models.ShopItem.create(shopItem);
    return res.status(StatusCode.SuccessOK).send(newItem);
});

/**
 * @api {put} /shop/item/:ITEMID PUT /shop/item/:ITEMID
 * @apiGroup Shop
 * @apiDescription Update fields of an existing item in the shop.
 * @apiBody {String} eventId The id of the event to follow.
 * @apiParamExample {json} Request Example:
 *     {
 *       "name": "HackIllinois Branded Hoodie",
 *       "price": 1000000,
 *       "isRaffle": false,
 *       "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
 *     }
 * @apiSuccess (200: Success) {String} Item upon performing updates.
 * @apiSuccessExample {json} Success Response:
 *	{
 *      "itemId": "item01",
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 1000000,
 *      "isRaffle": false,
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
 * }
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} BadRequest Item passed with invalid format.
 * @apiError (400: Bad Request) {String} ItemInRequestBody Omit itemId from request body.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (404: Not Found) {String} ItemNotFound Item with itemId not found.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.put("/item/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const targetItem: string | undefined = req.params.ITEMID as string;

    const itemFormat = req.body as ShopItem;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    if (itemFormat.itemId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ItemInRequestBody"));
    }

    if (!isValidItemFormat(itemFormat, false)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadRequest"));
    }

    const updatedItem: ShopItem | null = await Models.ShopItem.findOneAndUpdate({ itemId: targetItem }, itemFormat, {
        new: true,
    });

    if (!updatedItem) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send({ updatedItem });
});

/**
 * @api {delete} /shop/item/:ITEMID DELETE /shop/item/:ITEMID
 * @apiGroup Shop
 * @apiDescription Delete the a specific item in the point shop based itemId. No error is thrown if item is not found.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiSuccess (200: Success) {Json} success Indicates successful deletion of the user's profile.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "success": true
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.delete("/item/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const targetItem: string | undefined = req.params.ITEMID as string;
    await Models.ShopItem.deleteOne({ itemId: targetItem });
    return res.status(StatusCode.SuccessNoContent).send({ success: true });
});

/**
 * @api {get} /shop/item/qr/:ITEMID/ GET /shop/item/qr/:ITEMID/
 * @apiGroup Shop
 * @apiDescription Get a QR code of quantity number of items.
 *
 * @apiParam {String} ITEMID Id to generate the QR code for.
 *
 * @apiSuccess (200: Success) {String} itemId Item to generate a QR code for
 * @apiSuccess (200: Success) {String} qrInfo Array of stringified QR codes for the requested item 

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"itemId": "item0001",
 * 		"qrInfo": [
            "hackillinois://item?itemId=item49289&instance=4",
            "hackillinois://item?itemId=item49289&instance=73",
            "hackillinois://item?itemId=item49289&instance=69"
        ]
 * 	}
 *
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have elevated permissions.
 * @apiError (404: Not Found) {String} ItemNotFound Item doesn't exist in the database.
 * @apiUse strongVerifyErrors
 */
shopRouter.get("/item/qr/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const targetItem: string | undefined = req.params.ITEMID as string;
    const token: JwtPayload = res.locals.payload;

    if (!hasElevatedPerms(token)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const itemFormat: ShopItem | null = await Models.ShopItem.findOne({ itemId: targetItem });

    if (!itemFormat) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    const uris = itemFormat.instances.map((instance: string) => `hackillinois://item?itemId=${targetItem}&instance=${instance}`);
    return res.status(StatusCode.SuccessOK).send({ itemId: targetItem, qrInfo: uris });
});

/**
 * @api {post} /shop/item/buy/ POST /shop/item/buy/
 * @apiGroup Shop
 * @apiDescription Purchase item at the point shop using provided QR code.
 *
 * @apiHeader {String} Authorization User's JWT Token with attendee permissions.
 *
 * @apiBody {Json} itemId ItemId of item being purchased (from QR).
 * @apiBody {Json} instance Insance provided by uri to uniquely identify the item (from QR).
 * @apiParamExample {Json} Request Body Example for an Item:
 * {
 *      "itemId": "item0001",
 *      "instance": 19381922i31ox0902902,
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (200: Success) {String} Success Purchase was successful. Returns purchased item name on success.
 * @apiError (404: Forbidden) {String} AttendeeProfileNotFound User has no attendee profile.
 * @apiError (404: Not Found) {String} ItemNotFound Item with itemId not found or already purchased.
 * @apiError (404: Not Found) {String} InvalidUniqueItem This unique item is already purchased or doesn't exist.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.post("/item/buy", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const itemId: string | undefined = req.body.itemId as string;
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const itemFormat: ShopItem | null = await Models.ShopItem.findOne({ itemId: itemId });
    const userData: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    if (!itemFormat) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    if (!userData) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "AttendeeProfileNotFound"));
    }

    if (userData.coins < itemFormat.price) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InsufficientFunds"));
    }

    const instances = itemFormat.instances;

    for (let i = 0; i < instances.length; ++i) {
        // If this isn't the instance, move on
        if (instances[i] != req.body.instance) {
            continue;
        }

        // delete shop item
        const updatedShopQuantity = await Models.ShopItem.updateOne(
            { itemId: itemId },
            {
                $inc: { quantity: -1 },
                $pull: { instances: req.body.instance },
            },
        );

        const targetItem = await Models.ShopItem.findOne({ itemId: itemId });

        // decrement attendee coins
        if (updatedShopQuantity) {
            await updateCoins(userId, -itemFormat.price).then(console.error);
        }
        return res
            .status(StatusCode.SuccessOK)
            .send({ success: true, itemName: targetItem ? ["name"] : "Item Doesn't Exist :(" });
    }

    return next(new RouterError(StatusCode.ClientErrorNotFound, "InvalidUniqueItem"));
});

function getRand(index: number): string {
    const hash = crypto.createHash("sha256").update(`${Config.JWT_SECRET}|${index}`).digest("hex");
    return hash;
}

export default shopRouter;
