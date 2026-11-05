import type { ControllerClass } from "@antelopejs/interface-api";
import { DefaultDataTypes } from "@antelopejs/interface-dms/base/data-types/default-types";
import type { FormSection } from "@antelopejs/interface-dms/base/form";
import { AssetType } from "@antelopejs/interface-dms-media";
import { DEFAULT_BRAND_COLOR } from "./defaults";
import { LEGAL_FORMS } from "./options";

const NAV_GROUP = "$helio.settings.groups.company";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const LOGO_MAX_WIDTH = 1200;

/**
 * The company's identity fields. The enterprise number is fixed at
 * incorporation, so it is shown with its register badge and not edited here. The
 * VAT number's length limit leaves room for "BE 0123.456.789", although it is
 * stored without spaces or dots.
 */
const identitySection: FormSection = {
  id: "identity",
  label: "$helio.settings.sections.identity",
  description: "$helio.settings.sections.identity_description",
  icon: "i-ph-buildings",
  navGroup: NAV_GROUP,
  fields: [
    {
      id: "companyName",
      label: "$helio.settings.fields.companyName",
      type: new DefaultDataTypes.StringType({ maxLength: 80, showCount: true }),
      required: true,
    },
    {
      id: "legalForm",
      label: "$helio.settings.fields.legalForm",
      type: new DefaultDataTypes.SelectType({ items: LEGAL_FORMS }),
      required: true,
    },
    {
      id: "enterpriseNumber",
      label: "$helio.settings.fields.enterpriseNumber",
      type: new DefaultDataTypes.StringType(),
      readonly: {
        badge: { label: "$helio.settings.badges.registered", tone: "success" },
      },
    },
    {
      id: "vatNumber",
      label: "$helio.settings.fields.vatNumber",
      type: new DefaultDataTypes.StringType({
        placeholder: "BE0123456789",
        maxLength: 17,
      }),
      hint: "$helio.settings.hints.vatNumber",
      required: true,
    },
    {
      id: "address",
      label: "$helio.settings.fields.address",
      description: "$helio.settings.descriptions.address",
      type: new DefaultDataTypes.AddressType({ defaultCountry: "BE" }),
      required: true,
    },
    {
      id: "contact",
      label: "$helio.settings.fields.contact",
      orientation: "horizontal",
      fields: [
        {
          id: "phone",
          label: "$helio.settings.fields.phone",
          type: new DefaultDataTypes.PhoneType({
            placeholder: "+32 4 220 50 50",
          }),
        },
        {
          id: "email",
          label: "$helio.settings.fields.email",
          type: new DefaultDataTypes.EmailType(),
          required: true,
        },
      ],
    },
    {
      id: "website",
      label: "$helio.settings.fields.website",
      type: new DefaultDataTypes.UrlType({ placeholder: "https://" }),
    },
  ],
};

/**
 * The branding fields. The logo is a media-library asset, so the same logo is
 * reused by every document; its folder is named in French like the other Helio
 * media folders (platform/media).
 */
function brandingSection(page: ControllerClass): FormSection {
  return {
    id: "branding",
    label: "$helio.settings.sections.branding",
    description: "$helio.settings.sections.branding_description",
    icon: "i-ph-palette",
    navGroup: NAV_GROUP,
    fields: [
      {
        id: "brandColor",
        label: "$helio.settings.fields.brandColor",
        type: new DefaultDataTypes.ColorType(),
        defaultValue: DEFAULT_BRAND_COLOR,
        hint: "$helio.settings.hints.brandColor",
      },
      {
        id: "logo",
        label: "$helio.settings.fields.logo",
        description: "$helio.settings.descriptions.logo",
        type: new AssetType({
          mimetypes: ["image/png", "image/svg+xml", "image/webp"],
          binding: {
            id: "helio.settings.logo",
            folderName: "Logo de l'entreprise",
            permissionsFromPage: page,
          },
        }),
      },
      {
        id: "tagline",
        label: "$helio.settings.fields.tagline",
        description: "$helio.settings.descriptions.tagline",
        type: new DefaultDataTypes.StringType({ maxLength: 90 }),
        localized: true,
      },
      {
        id: "signature",
        label: "$helio.settings.fields.signature",
        description: "$helio.settings.descriptions.signature",
        type: new DefaultDataTypes.ImageType({
          path: "helio/settings",
          resize: { maxWidth: LOGO_MAX_WIDTH, maxHeight: LOGO_MAX_WIDTH },
          constraints: {
            maxSize: MAX_UPLOAD_BYTES,
            allowedMimetypes: ["image/png", "image/jpeg"],
          },
        }),
      },
      {
        id: "termsDocument",
        label: "$helio.settings.fields.termsDocument",
        description: "$helio.settings.descriptions.termsDocument",
        type: new DefaultDataTypes.FileType({
          path: "helio/settings",
          constraints: {
            maxSize: MAX_UPLOAD_BYTES,
            allowedMimetypes: ["application/pdf"],
          },
        }),
      },
    ],
  };
}

/** The Company part of the settings form: identity, then branding. */
export function companySections(page: ControllerClass): FormSection[] {
  return [identitySection, brandingSection(page)];
}
