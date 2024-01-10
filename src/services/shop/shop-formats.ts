export interface ItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
    quantity: number;
}

export interface QuantityFormat {
    itemId: string;
    quantity: number;
    secrets: number[];
}

export interface ShopItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
}
