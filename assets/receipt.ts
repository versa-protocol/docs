export interface receipt {
  id: string;
  currency: "usd" | "eur" | "jpy" | "gbp" | "aud" | "cad" | "chf" | "cnh";
  amount: number;
  subtotal: number;
  date_time: number;
  merchant_id: string;
  mcc?: string;
  third_party?: third_party;
  line_items: line_item[];
  actions: action[];
}

export interface merchant {
  id: string;
  name: string;
  brand_color?: string;
  logo?: string;
  website?: string;
}

export interface third_party {
  first_party_relation:
    | "bnpl"
    | "delivery_service"
    | "marketplace"
    | "payment_processor"
    | "platform"
    | "point_of_sale";
  make_primary: boolean;
  merchant: merchant;
}

export interface line_item {
  description: string;
  total: number;
  quantity?: number;
  unit_cost?: number;
  unit?: string;
  tax?: number;
  metadata?: [{ key: string; value: string }];
  product_image?: string;
  group?: string;
}

export interface action {
  description: string;
  url: string;
  icon?: string;
}
