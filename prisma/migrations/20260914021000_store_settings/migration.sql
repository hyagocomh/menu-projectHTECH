CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StoreSettings" (
    "id",
    "street",
    "number",
    "district",
    "city",
    "state",
    "formattedAddress",
    "latitude",
    "longitude",
    "updatedAt"
) VALUES (
    'main',
    'Rua São Jorge',
    '20',
    'Barro Duro',
    'Maceió',
    'AL',
    'Rua São Jorge, 20 - Barro Duro, Maceió - AL',
    -9.6192548,
    -35.7153547,
    CURRENT_TIMESTAMP
);
