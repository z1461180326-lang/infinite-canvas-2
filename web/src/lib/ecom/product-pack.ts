import { deleteStoredImages, uploadImage } from "@/services/image-storage";
import { ECOM_PRODUCT_VIEWS, type EcomProductPhotos, type EcomProductProfile } from "@/types/ecom";

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid product pack object");
    return value as Record<string, unknown>;
}

function readText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function readProductPack(file: File) {
    const pack = asRecord(JSON.parse(await file.text()));
    if (pack.format !== "infinite-canvas-product-v1") throw new Error("Unsupported product pack");
    const input = asRecord(pack.profile);
    const profile: EcomProductProfile = {
        name: readText(input.name),
        brand: readText(input.brand),
        model: readText(input.model),
        sellingPoints: readText(input.sellingPoints),
        mustKeep: readText(input.mustKeep),
        audience: readText(input.audience),
    };
    if (!profile.name && !profile.model) throw new Error("Missing product name or model");

    const entries = asRecord(pack.photos ?? {});
    const photos: EcomProductPhotos = {};
    try {
        for (const view of ECOM_PRODUCT_VIEWS) {
            if (entries[view] === undefined) continue;
            const input = asRecord(entries[view]);
            const data = input.data;
            if (typeof data !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(data)) throw new Error("Invalid product photo");
            const uploaded = await uploadImage(data);
            if (!uploaded.storageKey) throw new Error("Missing stored photo");
            photos[view] = {
                storageKey: uploaded.storageKey,
                name: readText(input.name) || view,
                type: uploaded.mimeType,
                brief: readText(input.brief) || undefined,
            };
        }
        return { profile, photos };
    } catch (error) {
        await deleteStoredImages(Object.values(photos).map((photo) => photo.storageKey)).catch(() => undefined);
        throw error;
    }
}
