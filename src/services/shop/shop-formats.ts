export interface ItemFormat {
    itemId: string;
    name: string;
    price: number;
    isRaffle: boolean;
    quantity: number;
    imageURL: string; 
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
    imageURL: string;
}
