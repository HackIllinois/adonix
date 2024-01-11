import Models from "../../database/models.js";

/**
 * Get user's current coin balance.
 * @param itemId ID of target item
 * @returns Price in coins (number)
 */
export async function getPrice(itemId: string): Promise<number | null> {
  var item = await Models.ShopItem.findOne({itemId: itemId}); 

  if (item) {
      return item.price;
  } else {
      return 0; 
  }
}
