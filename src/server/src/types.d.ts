declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      role: string;
      effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
    };
    session: {
      id: string;
    };
  }
  export interface Response {
    user: any;
  }
}
