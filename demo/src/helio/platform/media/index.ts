import { DEFAULT_TENANT_ID } from "@antelopejs/interface-dms/constants";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { Logging } from "@antelopejs/interface-core/logging";
import {
  EnsureMediaFolder,
  ImportMediaAsset,
  type MediaAssetDeclaration,
  type MediaDeclarationStatus,
  type MediaFolderDeclaration,
} from "@antelopejs/interface-dms-media";
import { brandFiles } from "./brand";
import { contractDocuments, type LibraryDocument } from "./contracts";
import { buildDatasheets } from "./datasheets";
import { DATASHEET_FOLDER_KEYS, FOLDER_KEYS, libraryFolders } from "./folders";
import { renderDocument } from "./pdf-layout";
import { contractProjects, photoProjects } from "./photos";
import { renderPhoto } from "./scenes";
import { TRAINING_DOCUMENTS } from "./training";

/** The binding of the settings page's logo field (see settings/sections-company.ts). */
const SETTINGS_LOGO_BINDING = "helio.settings.logo";

type Tally = Partial<Record<MediaDeclarationStatus | "failed", number>>;

/** A file to declare; its content is produced only when its turn comes. */
interface PendingAsset {
  key: string;
  folder: MediaAssetDeclaration["folder"];
  name: string;
  mimetype: string;
  alt?: string;
  source: () => MediaAssetDeclaration["source"];
}

function documentAssets(
  folderKey: string,
  docs: readonly LibraryDocument[],
): PendingAsset[] {
  return docs.map((doc) => ({
    key: `${folderKey}.${doc.slug}`,
    folder: { key: folderKey },
    name: doc.fileName,
    mimetype: "application/pdf",
    source: () => ({ bytes: renderDocument(doc.spec) }),
  }));
}

/**
 * The files of the brand folder. The logo is declared a second time in the
 * folder of the settings logo field, so the field's picker offers it straight
 * away.
 */
function brandAssets(): PendingAsset[] {
  const files = brandFiles();
  const assets = files.map((file): PendingAsset => ({
    key: `${FOLDER_KEYS.brand}.${file.slug}`,
    folder: { key: FOLDER_KEYS.brand },
    name: file.name,
    mimetype: file.mimetype,
    alt: file.alt,
    source: () => file.source,
  }));
  const logo = files.find((file) => file.slug === "logo");
  if (logo)
    assets.push({
      key: "helio.media.settings-logo",
      folder: { binding: SETTINGS_LOGO_BINDING },
      name: logo.name,
      mimetype: logo.mimetype,
      alt: logo.alt,
      source: () => logo.source,
    });
  return assets;
}

/** The media library the demo declares: its folders and the assets to upload. */
interface PlannedContent {
  folders: MediaFolderDeclaration[];
  assets: PendingAsset[];
}

function plannedContent(): PlannedContent {
  const projects = photoProjects();
  const datasheets: PendingAsset[] = buildDatasheets().map((sheet) => ({
    key: `${FOLDER_KEYS.datasheets}.${sheet.product.sku.toLowerCase()}`,
    folder: { key: DATASHEET_FOLDER_KEYS[sheet.family] },
    name: sheet.fileName,
    mimetype: "application/pdf",
    source: () => ({ bytes: renderDocument(sheet.spec) }),
  }));
  const photos: PendingAsset[] = projects.flatMap(({ photos: shots }) =>
    shots.map((shot) => ({
      key: shot.key,
      folder: { key: shot.folderKey },
      name: shot.name,
      mimetype: "image/png",
      alt: shot.alt,
      source: () => ({ bytes: renderPhoto(shot.kind, shot.seed) }),
    })),
  );
  return {
    folders: [...libraryFolders(), ...projects.map((p) => p.folder)],
    assets: [
      ...datasheets,
      ...photos,
      ...documentAssets(
        FOLDER_KEYS.contracts,
        contractDocuments(contractProjects(projects)),
      ),
      ...documentAssets(FOLDER_KEYS.training, TRAINING_DOCUMENTS),
      ...brandAssets(),
    ],
  };
}

async function declare(
  tally: Tally,
  key: string,
  run: () => Promise<{ status: MediaDeclarationStatus }>,
): Promise<void> {
  try {
    const { status } = await run();
    tally[status] = (tally[status] ?? 0) + 1;
  } catch (error) {
    tally.failed = (tally.failed ?? 0) + 1;
    Logging.Error(
      `[helio] media declaration '${key}' failed: ${String(error)}`,
    );
  }
}

/**
 * Declares the folders, then the files. The folders go in order, since a
 * folder's parent must be declared before it. The files are produced one at
 * a time, yielding to the event loop between them, so the generation never
 * holds it for long.
 */
async function declareMedia(): Promise<Tally> {
  const { folders, assets } = plannedContent();
  const tally: Tally = {};
  for (const folder of folders) {
    await declare(tally, folder.key, () => EnsureMediaFolder(folder));
  }
  for (const { source, ...asset } of assets) {
    await yieldToEventLoop();
    await declare(tally, asset.key, () =>
      ImportMediaAsset({
        tenantId: DEFAULT_TENANT_ID,
        ...asset,
        source: source(),
      }),
    );
  }
  return tally;
}

/**
 * Writes Helio's media library, shipped as code: folders and files declared by
 * stable keys. Called when the DMS provisions the default tenant; the content
 * is written once, and from then on it belongs to the tenant's members.
 */
export async function provisionHelioMedia(): Promise<void> {
  const tally = await declareMedia();
  Logging.Info(`[helio] media library declared: ${JSON.stringify(tally)}`);
  if (tally.failed) {
    throw new Error(`${tally.failed} media declaration(s) failed`);
  }
}
