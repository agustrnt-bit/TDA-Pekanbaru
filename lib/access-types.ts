export type UserRole = "ketua_ksb" | "bendahara" | "kadiv" | "viewer";

export type AccessUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  divisionId: number | null;
  divisionName: string | null;
};

export type AppAccess = {
  authenticated: boolean;
  registered: boolean;
  identity: { name: string; email: string } | null;
  user: AccessUser | null;
  permissions: {
    manageUsers: boolean;
    manageAllPrograms: boolean;
    manageOwnDivision: boolean;
    writePrograms: boolean;
    manageTreasury: boolean;
    manageMembership: boolean;
  };
};

export const anonymousAccess: AppAccess = {
  authenticated: false,
  registered: false,
  identity: null,
  user: null,
  permissions: {
    manageUsers: false,
    manageAllPrograms: false,
    manageOwnDivision: false,
    writePrograms: false,
    manageTreasury: false,
    manageMembership: false,
  },
};
