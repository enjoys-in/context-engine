import { createRequire } from "module";
const require = createRequire(import.meta.url);
const engine = require("./index.js");

export const getCommand = engine.getCommand;
export const getAllCommands = engine.getAllCommands;
export const listCommandNames = engine.listCommandNames;
export const getCommandsByCategory = engine.getCommandsByCategory;
export const getCommandsByPlatform = engine.getCommandsByPlatform;
export const searchCommands = engine.searchCommands;
export const getCategories = engine.getCategories;
export const getContextEngine = engine.getContextEngine;
export const getSubcommands = engine.getSubcommands;
export const getGlobalOptions = engine.getGlobalOptions;
export const getExamples = engine.getExamples;
export const count = engine.count;
export const clearCache = engine.clearCache;
export const resolveCommandPath = engine.resolveCommandPath;
export const dataDir = engine.dataDir;

export default engine;
