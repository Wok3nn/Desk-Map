export type Desk = {
  id: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string | null;
  occupantFirstName?: string | null;
  occupantLastName?: string | null;
};

export type MapConfig = {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundUrl?: string | null;
  deskColor?: string;
  deskShape?: "rectangle" | "rounded" | "capsule" | "circle" | "diamond";
  labelPosition?:
    | "inside"
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  showName?: boolean;
  showNumber?: boolean;
  deskTextSize?: number;
  deskVisibleWhenSearching?: boolean;
  updatedAt: string;
};

export type LayoutPayload = {
  map: MapConfig;
  desks: Desk[];
};
