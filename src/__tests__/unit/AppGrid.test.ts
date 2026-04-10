import { render } from "@testing-library/vue";
import { defineComponent, h, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";

import AppGrid from "@/components/AppGrid.vue";
import type { App } from "@/global/typedefinition";

vi.mock("@/components/AppCard.vue", () => ({
  default: defineComponent({
    name: "AppCard",
    props: {
      app: {
        type: Object,
        required: true,
      },
    },
    setup(props) {
      return () => h("div", props.app.name);
    },
  }),
}));

vi.mock("vue-virtual-scroller", () => ({
  RecycleScroller: defineComponent({
    name: "RecycleScroller",
    props: {
      items: {
        type: Array,
        required: true,
      },
    },
    setup(props, { attrs, slots }) {
      return () =>
        h(
          "div",
          {
            ...attrs,
            style: "max-height: 320px; overflow-y: auto;",
          },
          (props.items as Array<{ id: number; apps: App[] }>).map((item) =>
            slots.default?.({ item }),
          ),
        );
    },
  }),
}));

const createApp = (index: number, category: string): App => ({
  name: `App ${index}`,
  pkgname: `app-${category}-${index}`,
  version: "1.0.0",
  filename: "app.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "1 MB",
  more: "",
  tags: "",
  img_urls: [],
  icons: "",
  category,
  origin: "spark",
  currentStatus: "not-installed",
});

const createApps = (count: number, category: string): App[] =>
  Array.from({ length: count }, (_, index) => createApp(index, category));

describe("AppGrid", () => {
  it("resets the virtual scroller when the category changes", async () => {
    const { container, rerender } = render(AppGrid, {
      props: {
        apps: createApps(60, "development"),
        loading: false,
        scrollKey: "development",
      } as Record<string, unknown>,
    });

    const scroller = container.querySelector(".scroller");

    expect(scroller).toBeInstanceOf(HTMLElement);

    if (!(scroller instanceof HTMLElement)) {
      throw new Error("Expected virtual scroller element to exist");
    }

    scroller.scrollTop = 240;
    expect(scroller.scrollTop).toBe(240);

    await rerender({
      apps: createApps(60, "games"),
      loading: false,
      scrollKey: "games",
    } as Record<string, unknown>);
    await nextTick();

    expect(scroller.scrollTop).toBe(0);
  });
});
