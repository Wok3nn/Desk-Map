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
  deskIcon?: "none" | "badge" | "pin";
  labelPosition?: "inside" | "top" | "bottom" | "left" | "right";
  showName?: boolean;
  showNumber?: boolean;
  updatedAt: string;
};

export type LayoutPayload = {
  map: MapConfig;
  desks: Desk[];
};
