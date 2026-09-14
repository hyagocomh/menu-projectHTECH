import { z } from "zod";

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const deliveryQuoteRequestSchema = coordinatesSchema;

export const storeSettingsSchema = z.object({
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  district: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().length(2).toUpperCase(),
  formattedAddress: z.string().trim().min(5).max(300),
  ...coordinatesSchema.shape,
  deliveryPricingMode: z.enum(["FIXED", "PER_KM"]),
  baseDeliveryFeeCents: z.number().int().min(0).max(100_000),
  includedDistanceKm: z.number().min(0).max(100),
  additionalFeePerKmCents: z.number().int().min(0).max(100_000),
  maxDeliveryDistanceKm: z.number().positive().max(100),
});

export const orderRequestSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().min(10).max(13)),
    email: z.union([z.literal(""), z.string().trim().email().max(160)]).optional(),
  }),
  address: z.object({
    street: z.string().trim().min(2).max(160),
    number: z.string().trim().min(1).max(20),
    district: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().length(2).toUpperCase(),
    complement: z.string().trim().max(120).optional(),
    formattedAddress: z.string().trim().min(5).max(300),
    ...coordinatesSchema.shape,
  }),
  items: z.array(z.object({
    productId: z.string().min(1).max(180),
    quantity: z.number().int().min(1).max(99),
    notes: z.string().trim().max(200).optional(),
  })).min(1).max(72),
  paymentMethod: z.enum(["PIX", "CARD", "CASH"]),
  changeForCents: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const orderStatusSchema = z.enum([
  "RECEIVED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELED",
]);
