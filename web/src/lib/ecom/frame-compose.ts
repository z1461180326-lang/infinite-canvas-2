import { FULL_TRIM, trimImageContent, type TrimRect } from "@/lib/ecom/image-trim";
import { parseAspectRatio } from "@/lib/ecom/framing";
import type { EcomSubjectBox } from "@/types/ecom";

/**
 * 把产品按「画面构图」框摆进一张成片尺寸的白底画布。
 *
 * 为什么要有这一步：提示词里写「占宽 62%、中心距左 40%」对模型只是弱约束，
 * 它常常照着自己的审美重新构图。把布局先画进输入图，模型看到的就已经是最终位置，
 * 只剩「换背景」这件事要做，位置与大小基本能咬住。
 */

/** 合成画布的长边上限：够模型看清产品，又不会让请求体过大。 */
const MAX_EDGE = 2048;

function framePixelSize(ratio: string, target?: { width: number; height: number } | null) {
    if (target?.width && target?.height) {
        const longest = Math.max(target.width, target.height);
        const scale = Math.min(1, MAX_EDGE / longest);
        return { width: Math.max(8, Math.round(target.width * scale)), height: Math.max(8, Math.round(target.height * scale)) };
    }
    const aspect = parseAspectRatio(ratio);
    return aspect >= 1 ? { width: MAX_EDGE, height: Math.max(8, Math.round(MAX_EDGE / aspect)) } : { width: Math.max(8, Math.round(MAX_EDGE * aspect)), height: MAX_EDGE };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("image load failed"));
        image.src = src;
    });
}

export type FramedComposeInput = {
    /** 产品图（原始主图，带白边也行）。 */
    source: string;
    /** 画布上拖出来的框，百分比制。 */
    box: EcomSubjectBox;
    /** 输出比例，如 "3:4"。 */
    ratio: string;
    /** 输出像素尺寸；给得出就按它合成，位置与成片一格一格对得上。 */
    size?: { width: number; height: number } | null;
    /** 自己量过的边界，省一次重复分析。 */
    trim?: TrimRect | null;
};

/**
 * 合成结果是一张「成片比例 + 产品已在正确位置」的白底图。
 * 失败（跨域、解码异常、画布不可用）时返回 null，调用方退回原始产品图，不影响出图。
 */
export async function composeFramedProduct({ source, box, ratio, size, trim }: FramedComposeInput): Promise<{ dataUrl: string; trim: TrimRect | null } | null> {
    const image = await loadImage(source);
    if (!image.naturalWidth || !image.naturalHeight) return null;

    const crop = trim ?? (await trimImageContent(source)) ?? FULL_TRIM;
    const frame = framePixelSize(ratio, size);
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    // 白底：模型把它当「待填充的空白」，比透明背景稳
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, frame.width, frame.height);

    drawProduct(context, image, crop, box, frame);
    return { dataUrl: canvas.toDataURL("image/jpeg", 0.94), trim: trim ?? crop };
}

function productPlacement(image: HTMLImageElement, crop: TrimRect, box: EcomSubjectBox, frame: { width: number; height: number }) {
    const cropWidth = crop.width * image.naturalWidth;
    const cropHeight = crop.height * image.naturalHeight;
    let targetWidth = Math.max(8, (box.w / 100) * frame.width);
    // 高度按产品本体比例推，绝不为了填满去拉伸
    let targetHeight = Math.max(8, (targetWidth * cropHeight) / cropWidth);

    // 兜底：旧存档或换比例前的框可能放不下，按高度上限等比收回，位置保持在中心
    const maxHeight = frame.height * 0.96;
    if (targetHeight > maxHeight) {
        const k = maxHeight / targetHeight;
        targetWidth *= k;
        targetHeight *= k;
    }

    const centerX = (box.cx / 100) * frame.width;
    const centerY = (box.cy / 100) * frame.height;
    // 产品必须整件落在画面里：宁可整体平移，也不切角
    const left = clamp(centerX - targetWidth / 2, 0, Math.max(0, frame.width - targetWidth));
    const top = clamp(centerY - targetHeight / 2, 0, Math.max(0, frame.height - targetHeight));
    return { left, top, cropWidth, cropHeight, targetWidth, targetHeight };
}

function drawProduct(context: CanvasRenderingContext2D, image: HTMLImageElement, crop: TrimRect, box: EcomSubjectBox, frame: { width: number; height: number }) {
    const { left, top, cropWidth, cropHeight, targetWidth, targetHeight } = productPlacement(image, crop, box, frame);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, crop.left * image.naturalWidth, crop.top * image.naturalHeight, cropWidth, cropHeight, left, top, targetWidth, targetHeight);
}

type ProductCutout = { image: HTMLImageElement; crop: TrimRect };

/** 只取真实 alpha 的范围，不把产品上的白色、黑色或细字当作背景擦除。 */
export async function readProductCutout(source: string): Promise<ProductCutout | null> {
    const image = await loadImage(source);
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);

    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    let transparentBorder = false;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha === 0) {
                if (x === 0 || y === 0 || x === width - 1 || y === height - 1) transparentBorder = true;
                continue;
            }
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
        }
    }

    if (!transparentBorder || right < left || bottom < top) return null;
    const crop = { left: left / width, top: top / height, width: (right - left + 1) / width, height: (bottom - top + 1) / height };
    return { image, crop };
}

export function compositeLayout(cutout: ProductCutout, box: EcomSubjectBox, ratio: string, size?: FramedComposeInput["size"]) {
    const frame = size ?? framePixelSize(ratio);
    const { left, top, targetWidth, targetHeight } = productPlacement(cutout.image, cutout.crop, box, frame);
    const percent = (value: number) => Math.round(value * 100);
    return {
        left: percent(left / frame.width),
        right: percent((left + targetWidth) / frame.width),
        top: percent(top / frame.height),
        bottom: percent((top + targetHeight) / frame.height),
    };
}

export async function compositeProduct(cutout: ProductCutout, box: EcomSubjectBox, ratio: string, size?: FramedComposeInput["size"], background?: string) {
    const frame = size ?? framePixelSize(ratio);
    const canvas = document.createElement("canvas");
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is unavailable");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, frame.width, frame.height);
    if (background) {
        const image = await loadImage(background);
        const scale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, (frame.width - width) / 2, (frame.height - height) / 2, width, height);
    }

    drawProduct(context, cutout.image, cutout.crop, box, frame);
    return canvas.toDataURL("image/png");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
