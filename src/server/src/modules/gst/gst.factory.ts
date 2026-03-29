import { GstController } from "./gst.controller";
import { GstService } from "./gst.service";

export const makeGstController = () => {
  const service = new GstService();
  return new GstController(service);
};
