import Config from "../../common/config";
import { ShopItem } from "../../database/shop-db";
export interface FilteredShopItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
    quantity: number;
    imageURL: string;
}

export function isValidItemFormat(obj: ShopItem, itemIdRequired: boolean): boolean {
    if (typeof obj.itemId !== "string" || obj.itemId.length !== Config.SHOP_BYTES_GEN) {
        if (itemIdRequired) {
            return false;
        }
    }

    if (typeof obj.name !== "string") {
        return false;
    }

    if (typeof obj.price !== "number" || obj.price < 0) {
        return false;
    }

    if (typeof obj.isRaffle !== "boolean") {
        return false;
    }

    if (typeof obj.imageURL !== "string") {
        return false;
    }

    if (typeof obj.quantity !== "number" || obj.quantity < 0) {
        return false;
    }

    if (obj.instances) {
        return false;
    }

    return true;
}
