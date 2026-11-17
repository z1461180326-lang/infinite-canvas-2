import { Input } from "antd";
import { useTranslation } from "react-i18next";

import { useEcomStudioStore } from "@/stores/studio/use-ecom-studio-store";
import type { EcomProductProfile } from "@/types/ecom";
import { StudioSection } from "./section";

const FIELD_LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

export function ProductProfile() {
    const { t } = useTranslation();
    const profile = useEcomStudioStore((state) => state.productProfile);
    const setProductProfile = useEcomStudioStore((state) => state.setProductProfile);
    const setField = (field: keyof EcomProductProfile, value: string) => setProductProfile({ [field]: value });
    const identity = [profile.brand, profile.name, profile.model].filter(Boolean).join(" · ");

    return (
        <StudioSection index="02" title={t("studio.profile.title")} note={identity || t("studio.profile.optional")} collapsible collapseKey="product-profile">
            <p className="mb-2 text-xs leading-5 text-muted-foreground">{t("studio.profile.hint")}</p>

            <span className={FIELD_LABEL}>{t("studio.profile.name")}</span>
            <Input size="small" value={profile.name} placeholder={t("studio.profile.namePlaceholder")} onChange={(event) => setField("name", event.target.value)} />

            <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="min-w-0">
                    <span className={FIELD_LABEL}>{t("studio.profile.brand")}</span>
                    <Input size="small" value={profile.brand} placeholder={t("studio.profile.brandPlaceholder")} onChange={(event) => setField("brand", event.target.value)} />
                </label>
                <label className="min-w-0">
                    <span className={FIELD_LABEL}>{t("studio.profile.model")}</span>
                    <Input size="small" value={profile.model} placeholder={t("studio.profile.modelPlaceholder")} onChange={(event) => setField("model", event.target.value)} />
                </label>
            </div>

            <span className={`${FIELD_LABEL} mt-2`}>{t("studio.profile.sellingPoints")}</span>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={profile.sellingPoints} placeholder={t("studio.profile.sellingPointsPlaceholder")} onChange={(event) => setField("sellingPoints", event.target.value)} />

            <span className={`${FIELD_LABEL} mt-2`}>{t("studio.profile.mustKeep")}</span>
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={profile.mustKeep} placeholder={t("studio.profile.mustKeepPlaceholder")} onChange={(event) => setField("mustKeep", event.target.value)} />

            <span className={`${FIELD_LABEL} mt-2`}>{t("studio.profile.audience")}</span>
            <Input size="small" value={profile.audience} placeholder={t("studio.profile.audiencePlaceholder")} onChange={(event) => setField("audience", event.target.value)} />
        </StudioSection>
    );
}
