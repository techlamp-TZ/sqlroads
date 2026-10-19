import "../src/tokens/tokens.css";
import "../src/waffles/catalog/catalog.scss";

// Light / dark from the toolbar (or ?globals=theme:dark): the same switch the app uses (data-theme on <html>)
export const globalTypes = {
  theme: {
    description: "Colour theme",
    toolbar: { title: "Theme", icon: "mirror", items: [{ value: "light", title: "Light" }, { value: "dark", title: "Dark" }], dynamicTitle: true },
  },
};
export const initialGlobals = { theme: "light" };

const withTheme = (Story, ctx) => {
  const theme = ctx.globals.theme === "dark" ? "dark" : "light";
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  const Frame = ctx.parameters.legacyApp ? "header" : "main";
  return (
    <Frame className="wf-root wf-catalog" lang="en">
      <h1 className="cat-h">{ctx.title.split("/").pop() + ": " + ctx.name}</h1>
      <Story />
    </Frame>
  );
};

export const decorators = [withTheme];
export const parameters = { layout: "fullscreen", controls: { expanded: true } };
