import { App, Button, Input, Popconfirm, Select } from "antd";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { readProductPack } from "@/lib/ecom/product-pack";
import { useEcomStudioStore } from "@/stores/studio/use-ecom-studio-store";
import type { EcomProductProfile } from "@/types/ecom";
import { StudioSection } from "./section";

const FIELD_LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

export function ProductProfile() {
    const { t } = useTranslation();
    const { message, modal } = App.useApp();
    const importInput = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const profile = useEcomStudioStore((state) => state.productProfile);
    const profileId = useEcomStudioStore((state) => state.activeProductProfileId);
    const savedProfiles = useEcomStudioStore((state) => state.savedProductProfiles);
    const generating = useEcomStudioStore((state) => state.generating);
    const setProductProfile = useEcomStudioStore((state) => state.setProductProfile);
    const saveProductProfile = useEcomStudioStore((state) => state.saveProductProfile);
    const selectProductProfile = useEcomStudioStore((state) => state.selectProductProfile);
    const removeProductProfile = useEcomStudioStore((state) => state.removeProductProfile);
    const importProductProfile = useEcomStudioStore((state) => state.importProductProfile);
    const setField = (field: keyof EcomProductProfile, value: string) => setProductProfile({ [field]: value });
    const identity = profileLabel(profile);
    const saved = savedProfiles.find((entry) => entry.id === profileId);
    const dirty = (Object.keys(profile) as (keyof EcomProductProfile)[]).some((key) => profile[key] !== (saved?.profile[key] ?? ""));

    async function importPack(file: File) {
        setImporting(true);
        try {
            const { profile, photos } = await readProductPack(file);
            importProductProfile(profile, photos);
            message.success(t("studio.profile.imported", { name: profileLabel(profile) }));
        } catch {
            message.error(t("studio.profile.importFailed"));
        } finally {
            setImporting(false);
        }
    }

    function switchProduct(id: string) {
        const nextId = id || undefined;
        if (nextId === profileId) return;
        const { productImage, extraPrompt } = useEcomStudioStore.getState();
        if (!productImage && !extraPrompt && !dirty) {
            selectProductProfile(nextId);
            return;
        }
        modal.confirm({
            title: t("studio.profile.switchTitle"),
            content: t("studio.profile.switchDescription"),
            okText: t("studio.profile.switchAction"),
            onOk: () => selectProductProfile(nextId),
        });
    }

    return (
        <StudioSection
            index="01"
            title={t("studio.profile.title")}
            note={identity || t("studio.profile.optional")}
            actions={
                <>
                    <input
                        ref={importInput}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void importPack(file);
                        }}
                    />
                    <Button size="small" type="text" loading={importing} disabled={generating} onClick={() => importInput.current?.click()}>
                        {t("studio.profile.importPack")}
                    </Button>
                </>
            }
            collapsible
            collapseKey="product-profile"
        >
            <p className="mb-2 text-xs leading-5 text-muted-foreground">{t("studio.profile.hint")}</p>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <Select<string>
                    aria-label={t("studio.profile.picker")}
                    className="min-w-32 flex-1"
                    value={profileId ?? ""}
                    options={[
                        { value: "", label: t(profileId ? "studio.profile.newProfile" : "studio.profile.draft") },
                        ...savedProfiles.map((entry) => ({ value: entry.id, label: profileLabel(entry.profile) })),
                    ]}
                    onChange={switchProduct}
                    disabled={generating}
                />
                <Button
                    disabled={generating || (!profile.name.trim() && !profile.model.trim()) || !dirty}
                    onClick={() => {
                        saveProductProfile();
                        message.success(t("studio.profile.saved"));
                    }}
                >
                    {t(profileId ? "studio.profile.updateProfile" : "studio.profile.saveProfile")}
                </Button>
                {profileId ? (
                    <Popconfirm
                        title={t("studio.profile.removeTitle")}
                        description={t("studio.profile.removeDescription")}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => removeProductProfile(profileId)}
                    >
                        <Button type="text" danger disabled={generating}>{t("studio.profile.removeProfile")}</Button>
                    </Popconfirm>
                ) : null}
            </div>

            <label className="block">
                <span className={FIELD_LABEL}>{t("studio.profile.name")}</span>
                <Input size="small" value={profile.name} placeholder={t("studio.profile.namePlaceholder")} onChange={(event) => setField("name", event.target.value)} />
            </label>

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

            <label className="mt-2 block">
                <span className={FIELD_LABEL}>{t("studio.profile.sellingPoints")}</span>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={profile.sellingPoints} placeholder={t("studio.profile.sellingPointsPlaceholder")} onChange={(event) => setField("sellingPoints", event.target.value)} />
            </label>

            <label className="mt-2 block">
                <span className={FIELD_LABEL}>{t("studio.profile.mustKeep")}</span>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} value={profile.mustKeep} placeholder={t("studio.profile.mustKeepPlaceholder")} onChange={(event) => setField("mustKeep", event.target.value)} />
            </label>

            <label className="mt-2 block">
                <span className={FIELD_LABEL}>{t("studio.profile.audience")}</span>
                <Input size="small" value={profile.audience} placeholder={t("studio.profile.audiencePlaceholder")} onChange={(event) => setField("audience", event.target.value)} />
            </label>
        </StudioSection>
    );
}

function profileLabel(profile: EcomProductProfile) {
    return [profile.model, profile.name, profile.brand].map((part) => part.trim()).filter(Boolean).join(" · ");
}
