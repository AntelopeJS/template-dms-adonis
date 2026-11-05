import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import type {
  AclEntry,
  AclRight,
  MediaFolderDeclaration,
} from "@antelopejs/interface-dms-media";
import { HARDWARE_FAMILIES, type HardwareFamily } from "./datasheets";

/** Page permission ids, as the DMS derives them from the Helio page URLs. */
export const HELIO_PAGE_PERMISSIONS = {
  catalog: "helio.sales.catalog",
  quotes: "helio.sales.quotes",
  customers: "helio.sales.customers",
  projects: "helio.operations.projects",
  service: "helio.operations.service",
  team: "helio.operations.team",
  invoices: "helio.invoices",
  settings: "helio.settings",
} as const;

const grant = (permission: string, ...rights: AclRight[]): AclEntry => ({
  subject: { kind: "permission", id: permission },
  rights,
});

export const FOLDER_KEYS = {
  datasheets: "helio.media.datasheets",
  photos: "helio.media.site-photos",
  contracts: "helio.media.contracts",
  brand: "helio.media.brand",
  training: "helio.media.training",
} as const;

export const DATASHEET_FOLDER_KEYS: Record<HardwareFamily, string> = {
  "cat-panels": `${FOLDER_KEYS.datasheets}.panels`,
  "cat-inverters": `${FOLDER_KEYS.datasheets}.inverters`,
  "cat-storage": `${FOLDER_KEYS.datasheets}.batteries`,
  "cat-ev": `${FOLDER_KEYS.datasheets}.chargers`,
};

const DATASHEET_FOLDER_NAMES: Record<HardwareFamily, string> = {
  "cat-panels": "Panneaux solaires",
  "cat-inverters": "Onduleurs",
  "cat-storage": "Batteries",
  "cat-ev": "Bornes de recharge",
};

const P = HELIO_PAGE_PERMISSIONS;

/**
 * The folder tree of Helio's media library: the top-level folders, then the
 * datasheet families (children inherit the ACL). Each folder's ACL follows the
 * page whose people need it: a role granted the catalog page maintains the
 * datasheets, one granted the projects page files the site photos, and so on.
 * Only the owner manages the structure. The datasheets and the brand assets
 * are public, since the website links to them.
 */
export function libraryFolders(): MediaFolderDeclaration[] {
  const roots: MediaFolderDeclaration[] = [
    {
      tenantId: DEFAULT_TENANT_ID,
      key: FOLDER_KEYS.datasheets,
      name: "Fiches techniques",
      visibility: "public",
      acl: [
        grant(P.catalog, "write"),
        grant(P.quotes, "read"),
        grant(P.projects, "read"),
      ],
    },
    {
      tenantId: DEFAULT_TENANT_ID,
      key: FOLDER_KEYS.photos,
      name: "Photos de chantier",
      acl: [grant(P.projects, "write"), grant(P.service, "read")],
    },
    {
      tenantId: DEFAULT_TENANT_ID,
      key: FOLDER_KEYS.contracts,
      name: "Contrats et certificats",
      acl: [grant(P.invoices, "write"), grant(P.customers, "read")],
    },
    {
      tenantId: DEFAULT_TENANT_ID,
      key: FOLDER_KEYS.brand,
      name: "Marque et communication",
      visibility: "public",
      acl: [grant(P.settings, "write"), grant(P.quotes, "read")],
    },
    {
      tenantId: DEFAULT_TENANT_ID,
      key: FOLDER_KEYS.training,
      name: "Formation et sécurité",
      acl: [
        grant(P.team, "write"),
        grant(P.projects, "read"),
        grant(P.service, "read"),
      ],
    },
  ];
  const families = HARDWARE_FAMILIES.map((family): MediaFolderDeclaration => ({
    tenantId: DEFAULT_TENANT_ID,
    key: DATASHEET_FOLDER_KEYS[family],
    name: DATASHEET_FOLDER_NAMES[family],
    parent: FOLDER_KEYS.datasheets,
    visibility: "public",
  }));
  return [...roots, ...families];
}
