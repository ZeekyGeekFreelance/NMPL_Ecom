declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      role: string;
      effectiveRole?: "USER" | "DEALER" | "ADMIN" | "SUPERADMIN";
    };
    _decodedAccessToken?: {
      id: string;
      tv?: number;
    };
    traceId?: string;
    session: {
      id: string;
    };
  }
  export interface Response {
    user: any;
  }
}
