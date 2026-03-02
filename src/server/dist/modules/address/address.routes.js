"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const protect_1 = __importDefault(require("@/shared/middlewares/protect"));
const address_factory_1 = require("./address.factory");
const validateDto_1 = require("@/shared/middlewares/validateDto");
const address_dto_1 = require("./address.dto");
const router = express_1.default.Router();
const addressController = (0, address_factory_1.makeAddressController)();
/**
 * @swagger
 * /addresses:
 *   get:
 *     summary: Get all user addresses
 *     description: Retrieves a list of all addresses associated with the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of user addresses.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.get("/", protect_1.default, addressController.getUserAddresses);
router.post("/", protect_1.default, (0, validateDto_1.validateDto)(address_dto_1.CreateAddressDto), addressController.createAddress);
/**
 * @swagger
 * /addresses/{id}:
 *   get:
 *     summary: Get address details
 *     description: Retrieves detailed information about a specific address for the authenticated user.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the address to retrieve.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The details of the specified address.
 *       404:
 *         description: Address not found.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.get("/:addressId", protect_1.default, addressController.getAddressDetails);
router.patch("/:addressId", protect_1.default, (0, validateDto_1.validateDto)(address_dto_1.UpdateAddressDto), addressController.updateAddress);
router.patch("/:addressId/default", protect_1.default, addressController.setDefaultAddress);
/**
 * @swagger
 * /addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     description: Deletes the specified address for the authenticated user.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the address to delete.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Address successfully deleted.
 *       404:
 *         description: Address not found.
 *       401:
 *         description: Unauthorized. Token is invalid or missing.
 */
router.delete("/:addressId", protect_1.default, addressController.deleteAddress);
exports.default = router;
