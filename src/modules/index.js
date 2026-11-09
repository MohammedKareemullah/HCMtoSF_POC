import headcountRoutes from "./headcount/headcount.routes.js";

/** Register every KPI section here. One line per module. */
export function registerModules(app) {
  app.use("/api/headcount", headcountRoutes);
}
