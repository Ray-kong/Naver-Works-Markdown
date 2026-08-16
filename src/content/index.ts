import { WorksPreviewController } from "./controller";

const GLOBAL_CONTROLLER_KEY = "__worksMarkdownPreviewController__";

type ControllerGlobal = typeof globalThis & {
  [GLOBAL_CONTROLLER_KEY]?: WorksPreviewController;
};

const controllerGlobal = globalThis as ControllerGlobal;
const previousController = controllerGlobal[GLOBAL_CONTROLLER_KEY];
previousController?.stop();

export const contentController = new WorksPreviewController();
controllerGlobal[GLOBAL_CONTROLLER_KEY] = contentController;
contentController.start();

export const startContentScript = (): WorksPreviewController => {
  contentController.start();
  return contentController;
};

export const stopContentScript = (): void => contentController.stop();

export { WorksPreviewController } from "./controller";
