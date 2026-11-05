import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Get, HTTPResult, Parameter } from "@antelopejs/interface-api";
import {
  PageController,
  pageRoutePath,
  pagesCategory,
  RegisterPage,
} from "@antelopejs/interface-dms/page";
import type { StatGroupItem } from "@antelopejs/interface-dms/base/stat-group";
import {
  Card,
  Grid,
  GridRow,
  NavCardGrid,
  StatGroup,
} from "@antelopejs/interface-dms/base";
import { CustomComponent } from "@antelopejs/interface-dms/base/custom";
import { DefaultLayout } from "@antelopejs/interface-dms/base/layouts";
import { type HomeFigures, homeFigures } from "./home-figures";

const DOCS = "https://dms.antelopejs.com/docs";
const GITHUB = "https://github.com/AntelopeJS";
const HOME_SLUG = "/home";
const HTTP_NOT_FOUND = 404;

/**
 * Where the long texts live as Markdown, one file per section and language
 * (next to dist/, read on each request). They are not i18n keys because
 * Markdown and vue-i18n share `{`, `|` and `@`.
 */
const CONTENT_DIR = resolve(__dirname, "..", "content", "home");
const SECTIONS = [
  "why",
  "provides",
  "guide",
  "cases",
  "modules",
  "start",
  "contribute",
  "ai",
] as const;
type Section = (typeof SECTIONS)[number];

/** Whether `id` names one of the home page's Markdown sections. */
function isSection(id: string): id is Section {
  return SECTIONS.some((section) => section === id);
}

function contentLocale(language: string | undefined): "fr-FR" | "en-GB" {
  return language?.toLowerCase().startsWith("fr") ? "fr-FR" : "en-GB";
}

const count = (value: number) => ({ type: "count", value }) as const;

/** The five cells of the figures group, built from the figures counted at runtime. */
function figureItems(figures: HomeFigures): StatGroupItem[] {
  return [
    {
      id: "pages",
      icon: "i-ph-browsers",
      eyebrow: "$demo.home.figures.pages.eyebrow",
      value: figures.menuPages,
      detail: {
        key: "$demo.home.figures.pages.detail",
        params: { count: count(figures.detailPages) },
      },
      to: "/helio/dashboard",
    },
    {
      id: "collections",
      icon: "i-ph-database",
      eyebrow: "$demo.home.figures.collections.eyebrow",
      value: figures.collections,
      detail: "$demo.home.figures.collections.detail",
    },
    {
      id: "controllers",
      icon: "i-ph-plugs-connected",
      eyebrow: "$demo.home.figures.controllers.eyebrow",
      value: figures.dataControllers,
      detail: "$demo.home.figures.controllers.detail",
    },
    {
      id: "vue",
      icon: "i-ph-file-vue",
      tone: figures.customBlocks === 0 ? "success" : "warning",
      eyebrow: "$demo.home.figures.vue.eyebrow",
      value: figures.customBlocks,
      detail: "$demo.home.figures.vue.detail",
      detailTone: figures.customBlocks === 0 ? "success" : "neutral",
    },
    {
      id: "modules",
      icon: "i-ph-puzzle-piece",
      eyebrow: "$demo.home.figures.modules.eyebrow",
      value: figures.modules,
      detail: "$demo.home.figures.modules.detail",
      to: "/modules",
    },
  ];
}

/**
 * Catalogue metadata of the hero and the long-form sections, which are the demo's
 * own Vue components (frontend-vue/app/components/HomeHero.vue and HomeProse.vue)
 * because editorial blocks are not part of the DMS.
 */
const HOME_BLOCKS = {
  hero: {
    name: "$demo.home.blocks.hero.name",
    description: "$demo.home.blocks.hero.description",
    icon: "i-ph-flag-banner",
  },
  prose: {
    name: "$demo.home.blocks.prose.name",
    description: "$demo.home.blocks.prose.description",
    icon: "i-ph-article",
  },
};

/**
 * A section is a card filling its grid cell. HomeProse draws the Markdown the
 * section's route answers. `pair` lays two sections side by side; `full` spans
 * both columns of a row of one (the modules table, the AI section).
 */
const section = (id: Section) =>
  Card({ padded: true }).child(
    "text",
    CustomComponent("DemoHomeProse")
      .options({ fetchUrl: pageRoutePath(HOME_SLUG, `/sections/${id}`) })
      .meta(HOME_BLOCKS.prose),
  );
const pair = (left: Section, right: Section) =>
  GridRow().child(left, section(left)).child(right, section(right));
const full = (id: Section) => GridRow().child(id, section(id), { colSpan: 2 });

/**
 * The home page tells what the demo is for and how to build the same thing:
 * a hero, the figures counted live, then the story in long-form text.
 */
@RegisterPage()
export class PageHome extends PageController(
  "home",
  {
    displayName: "$demo.nav.home",
    icon: "i-ph-house",
    category: pagesCategory,
    order: 0,
    description: "$demo.pages.home.description",
  },
  DefaultLayout({ hideHeader: true }),
) {
  static hero = CustomComponent("DemoHomeHero")
    .options({
      eyebrow: "$demo.home.hero.eyebrow",
      title: "$demo.home.hero.title",
      highlight: "$demo.home.hero.highlight",
      lead: "$demo.home.hero.lead",
      icons: ["i-ph-sun", "i-ph-squares-four", "i-ph-lightning"],
      actions: [
        {
          label: "$demo.home.hero.open",
          to: "/helio/dashboard",
          icon: "i-ph-arrow-right",
          variant: "solid",
        },
        {
          label: "$demo.home.hero.docs",
          to: `${DOCS}/getting-started/introduction`,
          icon: "i-ph-book-open",
          variant: "outline",
        },
      ],
    })
    .meta(HOME_BLOCKS.hero);

  /**
   * Counted when the page is read, from what the module registered (see
   * home-figures.ts): nothing here is typed by hand.
   */
  static figures = StatGroup({
    layout: "cards",
    columns: 5,
    label: "$demo.home.figures.label",
    fetchUrl: pageRoutePath(HOME_SLUG, "/figures"),
    skeletonCount: 5,
  });

  static story = Grid({ gap: "1rem", minColumnWidth: "420px" })
    .child("intro", pair("why", "provides"))
    .child("use", pair("guide", "cases"))
    .child("modules", full("modules"))
    .child("build", pair("start", "contribute"))
    .child("ai", full("ai"));

  static links = NavCardGrid({
    title: "$demo.home.links.title",
    columns: 3,
    items: [
      {
        id: "helio",
        icon: "i-ph-sun",
        title: "$demo.home.links.helio.title",
        description: "$demo.home.links.helio.description",
        to: "/helio/dashboard",
      },
      {
        id: "docs",
        icon: "i-ph-book-open",
        title: "$demo.home.links.docs.title",
        description: "$demo.home.links.docs.description",
        to: `${DOCS}/getting-started/introduction`,
      },
      {
        id: "quickstart",
        icon: "i-ph-rocket-launch",
        title: "$demo.home.links.quickstart.title",
        description: "$demo.home.links.quickstart.description",
        to: `${DOCS}/getting-started/quickstart`,
      },
      {
        id: "modules",
        icon: "i-ph-puzzle-piece",
        title: "$demo.home.links.modules.title",
        description: "$demo.home.links.modules.description",
        to: "/modules",
      },
      {
        id: "store",
        icon: "i-ph-storefront",
        title: "$demo.home.links.store.title",
        description: "$demo.home.links.store.description",
        to: "/modules/store",
      },
      {
        id: "github",
        icon: "i-ph-github-logo",
        title: "$demo.home.links.github.title",
        description: "$demo.home.links.github.description",
        to: GITHUB,
      },
    ],
  });

  @Get("figures")
  async figureValues(): Promise<{ items: StatGroupItem[] }> {
    return { items: figureItems(await homeFigures()) };
  }

  @Get("sections/:id")
  async sectionText(
    @Parameter("id") id: string,
    @Parameter("x-content-language", "header") language: string | undefined,
  ): Promise<{ markdown: string }> {
    if (!isSection(id)) {
      throw new HTTPResult(HTTP_NOT_FOUND, { error: "Unknown section" });
    }
    const file = resolve(CONTENT_DIR, `${id}.${contentLocale(language)}.md`);
    return { markdown: await readFile(file, "utf8") };
  }
}
