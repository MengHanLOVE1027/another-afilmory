import { Button } from '@afilmory/ui'
import { useShallow } from 'zustand/shallow'

import { usePhotoUploadStore } from '../store'
import { UploadFileList } from '../UploadFileList'

export function UploadingStep() {
  const { uploadEntries, progress } = usePhotoUploadStore(
    useShallow((state) => ({
      uploadEntries: state.uploadEntries,
      progress: state.totalSize === 0 ? 0 : Math.min(1, state.uploadedBytes / state.totalSize),
    })),
  )
  const abortCurrent = usePhotoUploadStore((state) => state.abortCurrent)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-text text-lg font-semibold">正在上传文件</h2>
        <p className="text-text-tertiary text-sm">正在处理选中的文件，请保持页面打开，以免中断进度。</p>
      </div>

      <UploadFileList entries={uploadEntries} overallProgress={progress} />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={abortCurrent}
          className="text-rose-300 hover:text-rose-200"
        >
          停止上传
        </Button>
        <Button type="button" variant="primary" size="sm" disabled isLoading>
          上传中...
        </Button>
      </div>
    </div>
  )
}
