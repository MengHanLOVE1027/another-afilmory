import { Checkbox } from '@afilmory/ui'
import { useTranslation } from 'react-i18next'

type DeleteFromStorageOptionProps = {
  defaultChecked?: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
}

export function DeleteFromStorageOption({ defaultChecked = false, disabled, onChange }: DeleteFromStorageOptionProps) {
  const { t } = useTranslation()
  return (
    <label className="flex w-full items-start gap-3 my-2 text-left text-text">
      <Checkbox
        size="md"
        defaultChecked={defaultChecked}
        disabled={disabled}
        onCheckedChange={(value) => {
          onChange?.(Boolean(value))
        }}
      />
      <div className="text-sm leading-relaxed">
        <p className="font-medium">{t('photos.library.delete.option.title')}</p>
        <p className="text-xs text-text-tertiary">{t('photos.library.delete.option.description')}</p>
      </div>
    </label>
  )
}
