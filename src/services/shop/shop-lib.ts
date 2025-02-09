import Models from "../../common/models";

/**
 * Get user's current coin balance.
 * @param itemId ID of target item
 * @returns Price in points (number)
 */
export async function getPrice(itemId: string): Promise<number | null> {
    const item = await Models.ShopItem.findOne({ itemId: itemId });

    if (item) {
        return item.price;
    } else {
        return 0;
    }
}
