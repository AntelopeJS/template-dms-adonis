import { defineAsyncComponent, type Component } from "vue";
import type { DmsFrontendModule } from "#dms/frontend-module";

interface VueModule {
  default: Component;
}

/**
 * Every .vue file under app/components, registered globally as `Demo<Name>`,
 * the name a backend `CustomComponent("Demo<Name>")` resolves to. Helio ships
 * none: only the home page's hero and long-form sections are the demo's own.
 */
const components = import.meta.glob<VueModule>("./app/components/**/*.vue");

const frontendModule: DmsFrontendModule = {
  setup(sdk) {
    const entries = Object.entries(components).sort(([left], [right]) =>
      left < right ? -1 : 1,
    );
    for (const [path, loader] of entries) {
      const name = path.replace(/^.*\/|\.vue$/g, "");
      sdk.registerComponent(`Demo${name}`, defineAsyncComponent(loader));
    }
  },
};

export default frontendModule;
