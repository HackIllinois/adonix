export interface ShopItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
    quantity: number;
    imageURL: string;
    instances: string[];
}

export interface FilteredShopItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
    quantity: number;
    imageURL: string;
}

export interface ItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
    imageURL: string;
    quantity: number;
}