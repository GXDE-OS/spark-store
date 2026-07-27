<template>
  <div
    class="flex h-screen flex-col overflow-hidden rounded-3xl shadow-2xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
  >
    <div
      class="submitter-titlebar shrink-0 z-30 border-b border-slate-200/70 bg-white px-4 py-3 dark:border-slate-800/70 dark:bg-slate-900"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center"
          >
            <i class="fas fa-upload text-white"></i>
          </div>
          <h1 class="text-lg font-semibold">投稿应用</h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="submitter-close-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800"
            @click="openSubmissionQueue"
          >
            <i class="fas fa-list"></i>
            查看当前投稿队列
          </button>
          <button
            type="button"
            class="submitter-close-button inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            @click="closeWindow"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto mr-4 mb-4">
      <div class="p-6 max-w-2xl mx-auto">
      <div class="space-y-6">
        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >安装包 (deb)</label
          >
          <div
            class="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer dark:border-slate-700"
            @click="selectDebFile"
            @drop="handleDrop"
            @dragover="handleDragOver"
            @dragenter="handleDragEnter"
            @dragleave="handleDragLeave"
          >
            <input
              ref="debFileInput"
              type="file"
              accept=".deb"
              class="hidden"
              @change="handleDebFileSelect"
            />
            <div
              v-if="isParsingDeb || isSearchingHistory"
              class="flex flex-col items-center"
            >
              <div
                class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"
              ></div>
              <p class="text-slate-600 dark:text-slate-400">
                {{
                  isParsingDeb
                    ? "正在解析 deb 文件..."
                    : "正在从服务器查询已上架信息..."
                }}
              </p>
            </div>
            <div v-else>
              <i class="fas fa-cloud-upload text-4xl text-slate-400 mb-4"></i>
              <p class="text-slate-600 dark:text-slate-400">点击浏览</p>
              <p v-if="formData.debFilePath" class="mt-2 text-sm text-blue-500">
                {{ formData.debFilePath.split("/").pop() }}
              </p>
            </div>
          </div>
          <div
            v-if="debParseError"
            class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800"
          >
            <p class="text-yellow-700 dark:text-yellow-400 text-sm">
              {{ debParseError }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >应用名称</label
            >
            <input
              v-model="formData.name"
              type="text"
              placeholder="显示在商店中的名称"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >包名 (pkgname)</label
            >
            <input
              v-model="formData.pkgname"
              type="text"
              disabled
              title="包名由 deb 文件自动解析，不可手动修改"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 dark:bg-slate-700 dark:border-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >版本号</label
            >
            <input
              v-model="formData.version"
              type="text"
              disabled
              title="版本号由 deb 文件自动解析，不可手动修改"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-100 dark:bg-slate-700 dark:border-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label
              class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >作者</label
            >
            <input
              v-model="formData.author"
              type="text"
              placeholder="原作者信息"
              class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >官网地址</label
          >
          <input
            v-model="formData.website"
            type="url"
            placeholder="https://example.com"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >贡献者</label
          >
          <input
            v-model="formData.contributor"
            type="text"
            placeholder="你的名字"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >联系邮箱</label
          >
          <input
            v-model="formData.mail"
            type="email"
            placeholder="your@email.com"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >应用图标</label
          >
          <div
            class="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer dark:border-slate-700"
            @click="selectIconFile"
            @drop.prevent="handleIconDrop"
            @dragover.prevent
          >
            <input
              ref="iconFileInput"
              type="file"
              accept=".png"
              class="hidden"
              @change="handleIconFileSelect"
            />
            <div v-if="iconPreview" class="mb-4">
              <img
                :src="iconPreview"
                alt="图标预览"
                class="w-24 h-24 mx-auto rounded-lg object-contain border border-slate-300 dark:border-slate-600"
              />
            </div>
            <i v-else class="fas fa-image text-4xl text-slate-400 mb-4"></i>
            <p class="text-slate-600 dark:text-slate-400">
              {{ iconPreview ? "点击浏览更换图标" : "点击浏览" }}
            </p>
            <p v-if="iconFileName" class="mt-2 text-sm text-blue-500">
              {{ iconFileName }}
            </p>
          </div>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >截图（最多5张）</label
          >
          <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
            可点击添加、拖放或直接 Ctrl+V 粘贴 PNG 截图
          </p>
          <div
            tabindex="0"
            class="grid grid-cols-5 gap-3 rounded-lg border-2 border-dashed border-transparent p-2 transition-colors hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            @paste="handleScreenshotPaste"
            @drop="handleScreenshotDrop"
            @dragover.prevent
            @dragenter.prevent
            @dragleave.prevent
          >
            <div
              v-for="(screenshot, index) in formData.screenshots"
              :key="index"
              class="relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700"
            >
              <img :src="screenshot" class="w-full h-full object-cover" />
              <button
                type="button"
                class="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                @click="removeScreenshot(index)"
              >
                <i class="fas fa-times text-xs"></i>
              </button>
            </div>
            <div
              v-if="formData.screenshots.length < 5"
              class="aspect-square rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
              @click="addScreenshot"
            >
              <i class="fas fa-plus text-slate-400"></i>
            </div>
          </div>
          <input
            ref="screenshotInput"
            type="file"
            accept=".png"
            multiple
            class="hidden"
            @change="handleScreenshotSelect"
          />
          <p
            v-if="mediaError"
            class="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {{ mediaError }}
          </p>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >应用描述</label
          >
          <textarea
            v-model="formData.description"
            rows="4"
            placeholder="介绍你的应用功能和特点..."
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >标签</label
          >
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="tag in selectedTags"
              :key="tag.value"
              class="inline-flex items-center px-2.5 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            >
              {{ tag.name }}
              <button
                type="button"
                class="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
                @click="removeTag(tag.value)"
              >
                <i class="fas fa-times"></i>
              </button>
            </span>
          </div>
          <select
            v-model="selectedTagValue"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            @change="addTag"
          >
            <option value="">请选择标签</option>
            <option v-for="tag in tagsList" :key="tag.value" :value="tag.value">
              {{ tag.name }}
            </option>
          </select>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >测试情况</label
          >
          <input
            v-model="formData.remark"
            type="text"
            placeholder="写明在何种平台的测试情况"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >分类</label
          >
          <div v-if="isLoadingCategories" class="text-sm text-slate-400 py-2">
            正在加载分类列表...
          </div>
          <div
            v-else-if="categoriesLoadError"
            class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800"
          >
            <p class="text-yellow-700 dark:text-yellow-400 text-sm">
              分类加载失败: {{ categoriesLoadError }}
            </p>
          </div>
          <select
            v-else
            v-model="formData.category"
            class="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="" disabled>请选择分类</option>
            <option
              v-for="category in categoriesList"
              :key="category.id"
              :value="category.value"
            >
              {{ category.name }}
            </option>
          </select>
        </div>

        <div class="flex gap-3 pt-4">
          <button
            type="button"
            class="px-5 py-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            @click="resetForm"
          >
            重置
          </button>
          <button
            type="button"
            class="flex-1 px-5 py-3 rounded-lg border-2 border-emerald-500 bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-emerald-900/20 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
            :disabled="isPackaging || !isFormValid"
            @click="showArchPackDialog = true"
          >
            <span
              v-if="isPackaging"
              class="flex items-center justify-center gap-2"
            >
              <i class="fas fa-spinner fa-spin"></i>
              打包中...
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              <i class="fas fa-box-archive"></i>
              打包 tar.gz
            </span>
          </button>
          <button
            type="button"
            class="flex-1 px-5 py-3 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :disabled="isSubmitting || !isFormValid"
            @click="submitForm"
          >
            <span
              v-if="isSubmitting"
              class="flex items-center justify-center gap-2"
            >
              <i class="fas fa-spinner fa-spin"></i>
              提交中...
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              <i class="fas fa-paper-plane"></i>
              提交投稿
            </span>
          </button>
        </div>

        <!-- 表单校验提示 -->
        <div
          v-if="!isFormValid && hasUserStartedFilling"
          class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800"
        >
          <p
            class="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1.5"
          >
            请完善以下信息：
          </p>
          <ul class="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
            <li v-if="!formData.name.trim()">
              <i class="fas fa-times-circle mr-1"></i> 应用名称
            </li>
            <li v-if="!formData.pkgname.trim()">
              <i class="fas fa-times-circle mr-1"></i> 包名
            </li>
            <li v-if="!formData.version.trim()">
              <i class="fas fa-times-circle mr-1"></i> 版本号
            </li>
            <li v-if="!formData.category.trim()">
              <i class="fas fa-times-circle mr-1"></i> 分类
            </li>
            <li v-if="!formData.debFilePath">
              <i class="fas fa-times-circle mr-1"></i> 安装包
            </li>
            <li v-if="!formData.remark.trim()">
              <i class="fas fa-times-circle mr-1"></i> 测试情况
            </li>
            <li v-if="!formData.website.trim()">
              <i class="fas fa-times-circle mr-1"></i> 官网地址
            </li>
            <li
              v-if="
                formData.website.trim() && !isValidUrl(formData.website.trim())
              "
            >
              <i class="fas fa-times-circle mr-1"></i> 官网地址格式不正确（需以
              http:// 或 https:// 开头）
            </li>
            <li v-if="!formData.tags.trim()">
              <i class="fas fa-times-circle mr-1"></i> 标签
            </li>
            <li v-if="formData.screenshots.length === 0">
              <i class="fas fa-times-circle mr-1"></i> 至少上传一张截图
            </li>
          </ul>
        </div>

        <div
          v-if="isSubmitting || isPackaging"
          class="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800"
        >
          <div class="flex items-center gap-3 mb-3">
            <i
              class="fas fa-spinner fa-spin text-blue-500 dark:text-blue-400"
            ></i>
            <span class="text-blue-700 dark:text-blue-400 font-medium text-sm">
              {{ isPackaging ? "正在打包..." : uploadStage || "正在提交..." }}
            </span>
          </div>
          <div class="space-y-2">
            <div
              class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5"
            >
              <div
                class="h-2.5 rounded-full transition-all duration-300"
                :class="isPackaging ? 'bg-emerald-500' : 'bg-blue-500'"
                :style="{ width: uploadProgress + '%' }"
              ></div>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ uploadStageMessage || "准备中..." }}
            </p>
            <div
              v-if="uploadStages.length > 0 && !isPackaging"
              class="mt-3 space-y-1.5"
            >
              <div
                v-for="stage in uploadStages"
                :key="stage.stage"
                class="flex items-center gap-2 text-xs"
              >
                <i
                  v-if="stage.progress >= 100"
                  class="fas fa-check-circle text-green-500"
                ></i>
                <i
                  v-else-if="stage.progress > 0"
                  class="fas fa-spinner fa-spin text-blue-500"
                ></i>
                <i
                  v-else
                  class="far fa-circle text-slate-300 dark:text-slate-600"
                ></i>
                <span
                  :class="
                    stage.progress >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : stage.progress > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                  "
                  >{{ stage.label }}</span
                >
                <span
                  v-if="stage.progress > 0 && stage.progress < 100"
                  class="text-slate-400"
                  >{{ Math.floor(stage.progress) }}%</span
                >
              </div>
            </div>
          </div>
        </div>

        <div v-if="showSubmitSuccessModal" class="relative">
          <div
            class="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg"
          >
            <div class="flex items-center gap-3 mb-4">
              <div
                class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
              >
                <i class="fas fa-check-circle text-green-500 text-xl"></i>
              </div>
              <div>
                <h3 class="font-semibold text-slate-900 dark:text-slate-100">
                  投稿提交成功！
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  我们会尽快审核你的应用
                </p>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                class="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                @click="closeSubmitSuccessModal"
              >
                关闭
              </button>
              <button
                type="button"
                class="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                @click="continueSubmission"
              >
                继续投递
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="submitError"
          class="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800"
        >
          <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
            <i class="fas fa-exclamation-circle"></i>
            <span>{{ submitError }}</span>
          </div>
        </div>

        <div
          v-if="packageSuccess"
          class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg dark:bg-emerald-900/20 dark:border-emerald-800"
        >
          <div
            class="flex items-center gap-2 text-emerald-700 dark:text-emerald-400"
          >
            <i class="fas fa-check-circle"></i>
            <span
              >打包完成！文件已保存到: {{ packageResult?.tarFileName }}</span
            >
          </div>
        </div>

        <div
          v-if="packageError"
          class="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800"
        >
          <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
            <i class="fas fa-exclamation-circle"></i>
            <span>{{ packageError }}</span>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showArchPackDialog"
        data-submitter-arch-pack-dialog
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/50"
          @click="showArchPackDialog = false"
        ></div>
        <div
          class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <h2
              class="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              选择打包架构
            </h2>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              @click="showArchPackDialog = false"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>

          <p class="text-slate-600 dark:text-slate-400 mb-4">
            请选择目标架构以生成对应的 tar.gz 包：
          </p>

          <div class="space-y-3 mb-6">
            <button
              v-for="arch in packArchOptions"
              :key="arch.store"
              type="button"
              class="w-full p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-colors text-left"
              @click="selectPackArch(arch)"
            >
              <div class="flex items-center gap-2">
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    isSparkHistoryStore(arch.store)
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  "
                >
                  {{ isSparkHistoryStore(arch.store) ? "Spark" : "APM" }}
                </span>
                <span class="font-medium text-slate-900 dark:text-slate-100">
                  {{ getArchDisplayName(arch.store) }}
                </span>
              </div>
              <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                输出: {{ formData.pkgname.toLowerCase() }}-{{
                  arch.store
                }}.tar.gz
              </div>
            </button>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              @click="showArchPackDialog = false"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showArchDialog"
        data-submitter-arch-dialog
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/50"
          @click="showArchDialog = false"
        ></div>
        <div
          class="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <h2
              class="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              选择历史架构信息
            </h2>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              @click="showArchDialog = false"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>

          <p class="text-slate-600 dark:text-slate-400 mb-4">
            检测到该包名已有历史投稿记录，请选择架构以获取历史信息：
          </p>

          <div class="space-y-3 mb-6">
            <button
              v-for="arch in sortedArchs"
              :key="arch.store"
              type="button"
              class="w-full p-4 rounded-lg border-2 transition-colors text-left"
              :class="archOriginBorderClass(arch.store)"
              @click="selectArch(arch)"
            >
              <div class="flex items-center gap-2">
                <span class="font-medium text-slate-900 dark:text-slate-100">
                  {{ getArchDisplayName(arch.store) }}
                </span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="getOriginBadgeClass(arch.store)"
                >
                  {{ getOriginLabel(arch.store) }}
                </span>
              </div>
              <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                版本: {{ arch.version }} | 分类: {{ arch.category }}
              </div>
            </button>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              class="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              @click="showArchDialog = false"
            >
              跳过
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { APM_STORE_BASE_URL } from "@/global/storeConfig";

interface HistoryArchInfo {
  id: number;
  name: string;
  pkgname: string;
  version: string;
  store: string;
  author: string;
  contributor: string;
  website: string;
  category: string;
  tags: string;
  more: string;
  icon: string;
  imgs: string[];
}

const debFileInput = ref<HTMLInputElement | null>(null);
const iconFileInput = ref<HTMLInputElement | null>(null);
const screenshotInput = ref<HTMLInputElement | null>(null);

const formData = reactive({
  name: "",
  pkgname: "",
  version: "",
  author: "",
  contributor: "",
  mail: "",
  website: "",
  debFilePath: "",
  iconPath: "",
  screenshots: [] as string[],
  description: "",
  tags: "",
  category: "",
  categoryId: 0,
  remark: "",
});

// 当 category 变化时，从 categoriesList 中同步 categoryId
watch(
  () => formData.category,
  (val) => {
    const found = categoriesList.value.find((c) => c.value === val);
    formData.categoryId = found?.id ?? 0;
  },
);

const isSubmitting = ref(false);
const submitSuccess = ref(false);
const submitError = ref("");
const showSubmitSuccessModal = ref(false);
const isParsingDeb = ref(false);
const debParseError = ref("");
const isSearchingHistory = ref(false);
const showArchDialog = ref(false);
const availableArchs = ref<HistoryArchInfo[]>([]);
const currentDebArch = ref("");
const mediaError = ref("");
const iconPreview = ref("");
const iconFileName = ref("");

const uploadProgress = ref(0);
const uploadStage = ref("");
const uploadStageMessage = ref("");
const uploadStages = ref<{ stage: string; label: string; progress: number }[]>(
  [],
);

const isLoadingCategories = ref(false);
const categoriesLoadError = ref("");

const isPackaging = ref(false);
const packageSuccess = ref(false);
const packageError = ref("");
const showArchPackDialog = ref(false);
const packageResult = ref<{
  tarPath: string;
  tempDir: string;
  tarFileName: string;
} | null>(null);

const packArchOptions = [
  { store: "store", label: "AMD64 (x86_64)" },
  { store: "aarch64-store", label: "ARM64 (aarch64)" },
  { store: "loong64-store", label: "LoongArch64" },
];

interface Category {
  id: number;
  name: string;
  value: string;
}

interface Tag {
  name: string;
  value: string;
}

const categoriesList = ref<Category[]>([]);
const tagsList = ref<Tag[]>([]);
const selectedTags = ref<Tag[]>([]);
const selectedTagValue = ref("");

const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const getContributorFromGit = async (): Promise<string> => {
  try {
    const nameResult = await window.ipcRenderer.invoke("get-git-name");
    const emailResult = await window.ipcRenderer.invoke("get-git-email");

    const name = nameResult?.success ? nameResult.data : "";
    const email = emailResult?.success ? emailResult.data : "";

    if (name && email) {
      return `${name} <${email}>`;
    }
  } catch (error) {
    console.warn("[Submitter] Failed to get git config:", error);
  }
  return "";
};

const isFormValid = computed(() => {
  const hasRequiredFields =
    formData.name.trim() &&
    formData.pkgname.trim() &&
    formData.version.trim() &&
    formData.category.trim() &&
    formData.debFilePath &&
    formData.remark.trim() &&
    formData.website.trim() &&
    formData.tags.trim();

  if (!hasRequiredFields) return false;

  // 官网：必须为有效的 http/https URL
  if (!isValidUrl(formData.website.trim())) {
    return false;
  }

  // 截图：至少一张，且每张都是有效的 data URL 或 http/https URL
  if (formData.screenshots.length === 0) return false;
  for (const screenshot of formData.screenshots) {
    if (
      !screenshot.startsWith("data:") &&
      !screenshot.startsWith("http://") &&
      !screenshot.startsWith("https://")
    ) {
      return false;
    }
  }

  return true;
});

const hasUserStartedFilling = computed(() => {
  return (
    formData.name.trim() ||
    formData.pkgname.trim() ||
    formData.debFilePath ||
    formData.screenshots.length > 0
  );
});

const getHistoryArch = (
  store: string,
): "amd64" | "arm64" | "loong64" | "other" => {
  if (store === "store" || store.startsWith("amd64-")) return "amd64";
  if (store === "aarch64-store" || store.startsWith("arm64-")) return "arm64";
  if (store === "loong64-store" || store.startsWith("loong64-"))
    return "loong64";
  return "other";
};

const isSparkHistoryStore = (store: string): boolean => {
  // 兼容新格式（amd64-store / arm64-store / loong64-store / amd64-apm ...）
  // 与旧格式（store / aarch64-store / loong64-store）
  return store === "store" || store.endsWith("-store");
};

const sortHistoryArchs = (archs: HistoryArchInfo[]): HistoryArchInfo[] => {
  const archOrder: Record<ReturnType<typeof getHistoryArch>, number> = {
    amd64: 0,
    arm64: 1,
    loong64: 2,
    other: 3,
  };

  return [...archs].sort((a, b) => {
    const sourceOrder =
      Number(isSparkHistoryStore(b.store)) -
      Number(isSparkHistoryStore(a.store));
    if (sourceOrder !== 0) return sourceOrder;
    return (
      archOrder[getHistoryArch(a.store)] - archOrder[getHistoryArch(b.store)]
    );
  });
};

const getArchDisplayName = (store: string): string => {
  const arch = getHistoryArch(store);
  const archMap: Record<typeof arch, string> = {
    amd64: "AMD64 (x86_64)",
    arm64: "ARM64 (aarch64)",
    loong64: "LoongArch64",
    other: store,
  };
  return archMap[arch];
};

const sortedArchs = computed(() => sortHistoryArchs(availableArchs.value));

const getOriginLabel = (store: string): string => {
  return isSparkHistoryStore(store) ? "Spark" : "APM";
};

const getOriginBadgeClass = (store: string): string => {
  if (isSparkHistoryStore(store)) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
};

const archOriginBorderClass = (store: string): string => {
  if (isSparkHistoryStore(store)) {
    return "border-slate-200 dark:border-slate-700 hover:border-blue-500";
  }
  return "border-slate-200 dark:border-slate-700 hover:border-amber-400";
};

const loadCategoriesPromise = ref<Promise<void> | null>(null);

const loadCategoriesList = async (): Promise<void> => {
  // 防止并发调用
  if (isLoadingCategories.value) {
    if (loadCategoriesPromise.value) {
      return loadCategoriesPromise.value;
    }
    return;
  }

  isLoadingCategories.value = true;
  categoriesLoadError.value = "";

  const promise = (async () => {
    console.log(
      "[Submitter] ============== LOAD CATEGORIES START ==============",
    );

    try {
      const result = await window.ipcRenderer.invoke("get-category-list");

      if (result?.success && result.data) {
        const data = result.data;

        if (
          data.code === 0 &&
          Array.isArray(data.data) &&
          data.data.length > 0
        ) {
          categoriesList.value = data.data.map(
            (
              item: { id: number; name: string; type?: string },
              index: number,
            ) => ({
              id: typeof item.id === "number" ? item.id : index + 1,
              name: item.name || "",
              value: item.type || String(item.id),
            }),
          );
          categoriesLoadError.value = "";
          console.log(
            "[Submitter] Categories loaded from API:",
            categoriesList.value,
          );
        } else if (data.code === 0 && Array.isArray(data)) {
          categoriesList.value = data.map(
            (
              item: { id: number; name: string; type?: string },
              index: number,
            ) => ({
              id: typeof item.id === "number" ? item.id : index + 1,
              name: item.name || "",
              value: item.type || String(item.id),
            }),
          );
          categoriesLoadError.value = "";
          console.log(
            "[Submitter] Categories loaded from API (direct array):",
            categoriesList.value,
          );
        } else {
          const errMsg = `服务器返回异常: code=${data.code}, msg=${data.msg || "未知"}`;
          categoriesLoadError.value = errMsg;
          console.error("[Submitter]", errMsg);
        }
      } else {
        const errMsg = result?.message || "获取分类列表失败";
        categoriesLoadError.value = errMsg;
        console.error("[Submitter] IPC failed:", errMsg);
      }
    } catch (error) {
      const errMsg = (error as Error)?.message || "获取分类列表异常";
      categoriesLoadError.value = errMsg;
      console.error("[Submitter] Exception:", errMsg);
    } finally {
      isLoadingCategories.value = false;
      loadCategoriesPromise.value = null;
    }
  })();

  loadCategoriesPromise.value = promise;
  return promise;
};

const loadTagsList = async () => {
  console.log("[Submitter] ============== LOAD TAGS START ==============");
  console.log("[Submitter] Calling IPC: get-tags-list");

  try {
    const startTime = Date.now();
    const result = await window.ipcRenderer.invoke("get-tags-list");
    const endTime = Date.now();

    console.log(
      "[Submitter] ============== IPC RESPONSE RECEIVED ==============",
    );
    console.log("[Submitter] Request duration:", endTime - startTime, "ms");
    console.log("[Submitter] Result success:", result?.success);
    console.log("[Submitter] Result message:", result?.message);
    console.log("[Submitter] Full result:", JSON.stringify(result, null, 2));

    if (result?.success && result.data) {
      const data = result.data;
      console.log(
        "[Submitter] ============== PROCESSING RESPONSE ==============",
      );
      console.log("[Submitter] Response code:", data.code);
      console.log("[Submitter] Response message:", data.msg);
      console.log("[Submitter] Data type:", typeof data.data);
      console.log("[Submitter] Data length:", data.data?.length);
      console.log("[Submitter] Raw data:", JSON.stringify(data.data, null, 2));

      if (data.code === 0 && data.data) {
        tagsList.value = data.data.map(
          (item: { name: string; value: string }) => ({
            name: item.name,
            value: item.value,
          }),
        );
        console.log("[Submitter] ============== TAGS LOADED ==============");
        console.log("[Submitter] Tags list:", tagsList.value);
        console.log("[Submitter] Tags count:", tagsList.value.length);
      } else {
        console.error(
          "[Submitter] ============== INVALID RESPONSE CODE ==============",
        );
        console.error("[Submitter] Expected code 0, got:", data.code);
        console.error("[Submitter] Response message:", data.msg);
      }
    } else {
      console.error(
        "[Submitter] ============== IPC CALL FAILED ==============",
      );
      console.error("[Submitter] Success:", result?.success);
      console.error("[Submitter] Message:", result?.message);
      console.error("[Submitter] Data:", result?.data);
    }
  } catch (error) {
    console.error("[Submitter] ============== EXCEPTION CAUGHT ==============");
    console.error("[Submitter] Error type:", (error as Error)?.name);
    console.error("[Submitter] Error message:", (error as Error)?.message);
    console.error("[Submitter] Error stack:", (error as Error)?.stack);
  }
};

const addTag = () => {
  if (selectedTagValue.value) {
    const tag = tagsList.value.find((t) => t.value === selectedTagValue.value);
    if (tag && !selectedTags.value.some((t) => t.value === tag.value)) {
      selectedTags.value.push(tag);
      updateFormTags();
    }
    selectedTagValue.value = "";
  }
};

const removeTag = (tagValue: string) => {
  const index = selectedTags.value.findIndex((t) => t.value === tagValue);
  if (index !== -1) {
    selectedTags.value.splice(index, 1);
    updateFormTags();
  }
};

const updateFormTags = () => {
  formData.tags = selectedTags.value.map((t) => t.value).join(";");
};

const openSubmissionQueue = (): void => {
  window.open(
    "https://upload.spark-app.store/",
    "_blank",
    "noopener,noreferrer",
  );
};

const selectDebFile = async () => {
  const result = await window.ipcRenderer.invoke("select-deb-file");
  if (result?.success && result.filePath) {
    formData.debFilePath = result.filePath;
    await parseDebFileAndSearchHistory(result.filePath);
  }
};

const searchHistoryApp = async () => {
  console.log(
    "[Submitter] ============== SEARCHING HISTORY INFO ==============",
  );
  console.log(
    "[Submitter] pkgname is not empty, searching history with:",
    formData.pkgname,
  );

  console.log(
    "[Submitter] Calling IPC: search-history-app with pkgname:",
    formData.pkgname,
  );
  const historyResult = await window.ipcRenderer.invoke(
    "search-history-app",
    formData.pkgname,
    APM_STORE_BASE_URL,
  );
  console.log(
    "[Submitter] Received history search response:",
    JSON.stringify(historyResult, null, 2),
  );

  if (
    historyResult?.success &&
    historyResult.data &&
    historyResult.data.length > 0
  ) {
    console.log("[Submitter] ============== HISTORY INFO FOUND ==============");
    console.log("[Submitter] History info count:", historyResult.data.length);
    console.log(
      "[Submitter] Available archs data:",
      JSON.stringify(historyResult.data, null, 2),
    );

    console.log(
      "[Submitter] ============== BEFORE SETTING STATE ==============",
    );
    console.log("[Submitter] availableArchs before:", availableArchs.value);
    console.log("[Submitter] showArchDialog before:", showArchDialog.value);

    availableArchs.value = sortHistoryArchs(
      historyResult.data as HistoryArchInfo[],
    );
    console.log("[Submitter] availableArchs after:", availableArchs.value);
    console.log(
      "[Submitter] availableArchs length:",
      availableArchs.value.length,
    );

    // 确保分类列表已加载，避免 select 无法回显
    if (categoriesList.value.length === 0) {
      await loadCategoriesList();
    }

    // 从第一条历史记录预填名称和分类
    const firstArch = availableArchs.value[0];
    if (firstArch) {
      formData.name = firstArch.name || formData.name;
      formData.category = firstArch.category || formData.category;
    }

    showArchDialog.value = true;
    console.log("[Submitter] showArchDialog after:", showArchDialog.value);

    console.log(
      "[Submitter] ============== DIALOG SHOULD BE SHOWING ==============",
    );
    console.log("[Submitter] Dialog visibility:", showArchDialog.value);
    console.log(
      "[Submitter] Available architectures to display:",
      availableArchs.value.map((a) => a.store),
    );

    nextTick(() => {
      console.log("[Submitter] ============== AFTER NEXT TICK ==============");
      console.log(
        "[Submitter] showArchDialog in nextTick:",
        showArchDialog.value,
      );
      console.log(
        "[Submitter] availableArchs in nextTick:",
        availableArchs.value,
      );

      const dialogElement = document.querySelector(
        "[data-submitter-arch-dialog]",
      );
      console.log("[Submitter] Dialog element found:", !!dialogElement);
      if (dialogElement) {
        console.log("[Submitter] Dialog element:", dialogElement);
        console.log(
          "[Submitter] Dialog element style:",
          window.getComputedStyle(dialogElement),
        );
      }
    });
  } else {
    console.log(
      "[Submitter] ============== NO HISTORY INFO FOUND ==============",
    );
    console.log("[Submitter] historyResult.success:", historyResult?.success);
    console.log("[Submitter] historyResult.data:", historyResult?.data);
    console.log(
      "[Submitter] historyResult.data.length:",
      historyResult?.data?.length,
    );

    if (historyResult?.success === true && historyResult.data) {
      console.log("[Submitter] Success is true but no data found");
      console.log("[Submitter] Data is:", historyResult.data);
      console.log("[Submitter] Data type:", typeof historyResult.data);
    } else if (!historyResult?.success) {
      console.log(
        "[Submitter] Search failed with message:",
        historyResult?.message,
      );
    }
    // 未找到历史记录时清空旧数据，避免上一个应用的残留
    availableArchs.value = [];
    showArchDialog.value = false;
  }
};

const parseDebFileAndSearchHistory = async (debPath: string) => {
  isParsingDeb.value = true;
  debParseError.value = "";
  availableArchs.value = [];
  showArchDialog.value = false;
  formData.pkgname = "";
  formData.version = "";
  formData.author = "";
  formData.contributor = "";
  formData.website = "";
  formData.description = "";
  currentDebArch.value = "";

  try {
    console.log(
      "[Submitter] ============== STARTING DEB FILE PARSING ==============",
    );
    console.log("[Submitter] Input debPath:", debPath);
    console.log("[Submitter] debPath type:", typeof debPath);
    console.log("[Submitter] debPath length:", debPath.length);

    console.log("[Submitter] Calling IPC: parse-deb-file with path:", debPath);
    const parseResult = await window.ipcRenderer.invoke(
      "parse-deb-file",
      debPath,
    );
    console.log(
      "[Submitter] Received IPC response:",
      JSON.stringify(parseResult, null, 2),
    );

    if (parseResult?.success && parseResult.data) {
      const debInfo = parseResult.data;
      console.log(
        "[Submitter] Parsed debInfo successfully:",
        JSON.stringify(debInfo, null, 2),
      );

      console.log("[Submitter] Setting form data from debInfo:");
      console.log("[Submitter]   pkgname:", debInfo.pkgname);
      console.log("[Submitter]   version:", debInfo.version);
      console.log("[Submitter]   author:", debInfo.author);
      console.log("[Submitter]   maintainer:", debInfo.maintainer);
      console.log("[Submitter]   homepage:", debInfo.homepage);
      console.log("[Submitter]   description:", debInfo.description);
      console.log("[Submitter]   architecture:", debInfo.architecture);

      formData.pkgname = debInfo.pkgname || "";
      formData.version = debInfo.version || "";
      formData.author = debInfo.author || debInfo.maintainer || "";
      formData.contributor = debInfo.maintainer || "";
      formData.website = debInfo.homepage || "";
      formData.description = debInfo.description || "";
      currentDebArch.value = debInfo.architecture || "";

      console.log(
        "[Submitter] Form data after setting:",
        JSON.stringify(formData, null, 2),
      );

      const gitContributor = await getContributorFromGit();
      if (gitContributor) {
        formData.contributor = gitContributor;
        console.log("[Submitter] Contributor updated from git:", gitContributor);
      }

      if (formData.pkgname) {
        isSearchingHistory.value = true;
        try {
          await searchHistoryApp();
        } finally {
          isSearchingHistory.value = false;
        }
      }
    } else {
      console.error("[Submitter] Failed to parse deb file");
      console.error("[Submitter] parseResult.success:", parseResult?.success);
      console.error("[Submitter] parseResult.message:", parseResult?.message);
      debParseError.value = parseResult?.message || "解析deb文件失败";
    }
  } catch (error) {
    console.error("[Submitter] Exception caught during deb parsing:", error);
    console.error("[Submitter] Error stack:", (error as Error)?.stack);
    debParseError.value = (error as Error)?.message || "解析deb文件失败";
  } finally {
    isParsingDeb.value = false;
    console.log(
      "[Submitter] ============== DEB FILE PARSING COMPLETED ==============",
    );
  }
};

const handleDebFileSelect = async (_event: Event) => {};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  console.log(
    "[Submitter] Drag over detected, types available:",
    event.dataTransfer?.types,
  );
};

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault();
  console.log("[Submitter] Drag enter detected");
};

const handleDragLeave = (event: DragEvent) => {
  console.log("[Submitter] Drag leave detected");
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();

  console.log("[Submitter] Drop event triggered");
  console.log("[Submitter] DataTransfer types:", event.dataTransfer?.types);

  const files = event.dataTransfer?.files;
  console.log("[Submitter] Files count:", files?.length);

  if (files && files.length > 0) {
    const file = files[0] as File & { path?: string };
    console.log("[Submitter] File name:", file.name);
    console.log("[Submitter] File type:", file.type);
    console.log("[Submitter] File path (from File object):", file.path);

    if (file.name.endsWith(".deb")) {
      console.log("[Submitter] File is a deb package");

      // 在 contextIsolation 环境下，File.path 不可用
      // 使用 Electron 的 webUtils.getPathForFile() 获取真实文件系统路径
      let filePath: string;
      try {
        filePath = window.electronUtils.getPathForFile(file);
        console.log("[Submitter] File path from electronUtils:", filePath);
      } catch {
        console.warn(
          "[Submitter] electronUtils.getPathForFile failed, trying fallback",
        );
        const textUriList = event.dataTransfer?.getData("text/uri-list");
        const textPlain = event.dataTransfer?.getData("text/plain");
        filePath = textUriList || textPlain || "";
      }
      console.log("[Submitter] Final filePath:", filePath);

      if (filePath) {
        let path = filePath;
        if (path.startsWith("file://")) {
          path = path.replace("file://", "");
        }
        console.log("[Submitter] Cleaned path:", path);

        formData.debFilePath = path;
        console.log("[Submitter] Calling parseDebFileAndSearchHistory...");
        await parseDebFileAndSearchHistory(path);
        console.log("[Submitter] parseDebFileAndSearchHistory completed");
      } else {
        console.error("[Submitter] No valid file path found");
        debParseError.value = "无法获取文件路径，请使用点击方式选择文件";
      }
    } else {
      console.warn("[Submitter] File is not a deb package:", file.name);
      debParseError.value = "请选择 .deb 格式的安装包";
    }
  } else {
    console.error("[Submitter] No files found in drop event");
    debParseError.value = "拖放的文件无效";
  }
};

const selectArch = async (arch: HistoryArchInfo) => {
  showArchDialog.value = false;
  console.log("[Submitter] selectArch called with:", arch);

  // 确保分类列表已加载，避免 select 无法回显
  if (categoriesList.value.length === 0) {
    await loadCategoriesList();
  }

  formData.name = arch.name || formData.name;
  formData.author = arch.author || formData.author;
  if (!formData.contributor) {
    formData.contributor = arch.contributor || "";
  }
  formData.website = arch.website || formData.website;
  formData.category = arch.category || formData.category;
  formData.description = arch.more || formData.description;

  if (arch.tags) {
    const tagValues = arch.tags.split(";").filter((t) => t.trim());
    selectedTags.value = tagValues
      .map((value) => {
        const existingTag = tagsList.value.find((t) => t.value === value);
        if (existingTag) {
          return existingTag;
        }
        return { name: value, value };
      })
      .filter((t) => t);
    updateFormTags();
    console.log("[Submitter] Tags loaded from history:", selectedTags.value);
  }

  // 开发模式下来自 Vite 代理的路径（如 /local_amd64-store），
  // 后端 fetch/fs 无法处理，需要解析为实际 CDN 地址
  const resolvedBaseUrl = APM_STORE_BASE_URL.startsWith("/")
    ? "https://erotica.spark-app.store"
    : APM_STORE_BASE_URL;
  const baseUrl = `${resolvedBaseUrl}/${arch.store}/${arch.category}/${arch.pkgname}`;

  console.log(
    "[Submitter] Building icon and screenshot URLs with baseUrl:",
    baseUrl,
  );

  if (arch.icon) {
    formData.iconPath = `${baseUrl}/icon.png`;
    iconPreview.value = formData.iconPath;
    iconFileName.value = "icon.png";
    console.log("[Submitter] Icon URL:", formData.iconPath);
    console.log("[Submitter] Icon preview set:", iconPreview.value);
  }

  if (arch.imgs && arch.imgs.length > 0) {
    formData.screenshots = arch.imgs.slice(0, 5);
    console.log("[Submitter] Screenshots from history:", formData.screenshots);
  } else {
    formData.screenshots = [];
    for (let i = 1; i <= 5; i++) {
      formData.screenshots.push(`${baseUrl}/screen_${i}.png`);
    }
    console.log("[Submitter] Screenshots generated:", formData.screenshots);
  }

  showArchDialog.value = false;
};

const selectIconFile = () => {
  iconFileInput.value?.click();
};

const isPngFile = (file: File): boolean => {
  return (
    file.type === "image/png" || (file.type === "" && /\.png$/i.test(file.name))
  );
};

const readIconFile = (file: File): void => {
  iconFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    formData.iconPath = dataUrl;
    iconPreview.value = dataUrl;
  };
  reader.readAsDataURL(file);
};

const handleIconFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    if (isPngFile(file)) {
      mediaError.value = "";
      readIconFile(file);
    } else {
      mediaError.value = "应用图标仅支持 PNG 格式。";
    }
  }
  target.value = "";
};

const handleIconDrop = (event: DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (isPngFile(file)) {
    mediaError.value = "";
    readIconFile(file);
  } else {
    mediaError.value = "应用图标仅支持 PNG 格式。";
  }
};

const addScreenshot = () => {
  screenshotInput.value?.click();
};

const importScreenshots = (files: File[]) => {
  const pngFiles = files.filter(isPngFile);
  if (pngFiles.length !== files.length) {
    mediaError.value = "截图仅支持 PNG 格式。";
  } else if (pngFiles.length > 0) {
    mediaError.value = "";
  }

  for (const file of pngFiles) {
    if (formData.screenshots.length >= 5) break;

    const reader = new FileReader();
    reader.onload = () => {
      if (
        formData.screenshots.length < 5 &&
        typeof reader.result === "string"
      ) {
        formData.screenshots.push(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }
};

const handleScreenshotSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  importScreenshots(Array.from(target.files ?? []));
  target.value = "";
};

const handleScreenshotDrop = (event: DragEvent) => {
  event.preventDefault();
  importScreenshots(Array.from(event.dataTransfer?.files ?? []));
};

const handleScreenshotPaste = (event: ClipboardEvent) => {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

  if (files.length > 0) {
    event.preventDefault();
    importScreenshots(files);
  }
};

const removeScreenshot = (index: number) => {
  formData.screenshots.splice(index, 1);
};

const resetForm = () => {
  formData.name = "";
  formData.pkgname = "";
  formData.version = "";
  formData.author = "";
  formData.contributor = "";
  formData.mail = "";
  formData.website = "";
  formData.debFilePath = "";
  formData.iconPath = "";
  formData.screenshots = [];
  formData.description = "";
  formData.tags = "";
  formData.category = "";
  formData.categoryId = 0;
  formData.remark = "";
  submitSuccess.value = false;
  submitError.value = "";
  debParseError.value = "";
  mediaError.value = "";
  packageSuccess.value = false;
  packageError.value = "";
  packageResult.value = null;
  iconFileName.value = "";
  iconPreview.value = "";
  uploadProgress.value = 0;
  uploadStage.value = "";
  uploadStageMessage.value = "";
  uploadStages.value = [];
  selectedTags.value = [];
  selectedTagValue.value = "";
  availableArchs.value = [];
  showArchDialog.value = false;
  currentDebArch.value = "";
  isSearchingHistory.value = false;
};

const clearSubmitTransientState = (): void => {
  showSubmitSuccessModal.value = false;
  submitSuccess.value = false;
  isSubmitting.value = false;
  uploadProgress.value = 0;
  uploadStage.value = "";
  uploadStageMessage.value = "";
  uploadStages.value = [];
};

const closeSubmitSuccessModal = () => {
  clearSubmitTransientState();
};

const continueSubmission = () => {
  const shouldClear = window.confirm(
    "是否清空当前表单内容后继续投递？选择“取消”将保留已填写内容。",
  );
  if (shouldClear) {
    resetForm();
  } else {
    clearSubmitTransientState();
  }
};

const submitForm = async () => {
  if (!isFormValid.value) return;

  isSubmitting.value = true;
  submitSuccess.value = false;
  submitError.value = "";

  uploadProgress.value = 0;
  uploadStage.value = "准备提交...";
  uploadStageMessage.value = "正在准备...";
  uploadStages.value = [
    { stage: "icon", label: "上传图标", progress: 0 },
    { stage: "screenshots", label: "上传截图", progress: 0 },
    { stage: "deb", label: "上传安装包", progress: 0 },
    { stage: "submit", label: "提交信息", progress: 0 },
  ];

  const progressListener = (
    _event: unknown,
    data: { step: string; progress: number; message: string },
  ) => {
    let stageIndex: number;
    if (data.step.startsWith("screenshot")) {
      stageIndex = uploadStages.value.findIndex(
        (s) => s.stage === "screenshots",
      );
    } else {
      stageIndex = uploadStages.value.findIndex((s) => s.stage === data.step);
    }
    if (stageIndex !== -1) {
      uploadStages.value[stageIndex].progress = Math.max(
        uploadStages.value[stageIndex].progress,
        data.progress,
      );
    }
    if (data.progress >= 100 && !data.step.startsWith("screenshot")) {
      uploadProgress.value = data.progress;
    } else {
      uploadProgress.value = Math.max(uploadProgress.value, data.progress);
    }
    uploadStage.value = data.message;
    uploadStageMessage.value = data.message;
  };

  window.ipcRenderer.on("submit-upload-progress", progressListener);

  try {
    const submitData = {
      name: formData.name,
      pkgname: formData.pkgname,
      version: formData.version,
      author: formData.author,
      contributor: formData.contributor,
      mail: formData.mail,
      website: formData.website,
      debFilePath: formData.debFilePath,
      iconPath: formData.iconPath,
      screenshots: [...formData.screenshots],
      description: formData.description,
      tags: formData.tags,
      category: formData.category,
      categoryId: formData.categoryId,
      remark: formData.remark,
      arch: currentDebArch.value,
    };

    console.log("[Submitter] ============== SUBMIT FORM ==============");
    console.log(
      "[Submitter] Submit data:",
      JSON.stringify(submitData, null, 2),
    );
    console.log(
      "[Submitter] Screenshots count:",
      submitData.screenshots.length,
    );
    console.log("[Submitter] Icon path:", submitData.iconPath);

    const result = await window.ipcRenderer.invoke("submit-app", submitData);

    if (result?.success) {
      uploadStages.value.forEach((s) => (s.progress = 100));
      uploadProgress.value = 100;
      uploadStage.value = "提交完成";
      uploadStageMessage.value = "投稿提交成功！";
      submitSuccess.value = true;
      showSubmitSuccessModal.value = true;
    } else {
      submitError.value = result?.message || "提交失败";
    }
  } catch (error) {
    submitError.value = (error as Error)?.message || "提交失败";
  } finally {
    window.ipcRenderer.off("submit-upload-progress", progressListener);
    isSubmitting.value = false;
  }
};

const selectPackArch = async (arch: { store: string; label: string }) => {
  showArchPackDialog.value = false;
  await packageApp(arch.store);
};

const packageApp = async (storeArch: string) => {
  if (!isFormValid.value) return;

  isPackaging.value = true;
  packageSuccess.value = false;
  packageError.value = "";
  packageResult.value = null;

  uploadProgress.value = 0;
  uploadStage.value = "准备打包...";
  uploadStageMessage.value = "正在准备...";
  uploadStages.value = [
    { stage: "init", label: "创建临时目录", progress: 0 },
    { stage: "icon", label: "处理图标", progress: 0 },
    { stage: "screenshots", label: "处理截图", progress: 0 },
    { stage: "deb", label: "复制安装包", progress: 0 },
    { stage: "json", label: "生成配置文件", progress: 0 },
    { stage: "tar", label: "打包压缩", progress: 0 },
  ];

  const progressListener = (
    _event: unknown,
    data: { step: string; progress: number; message: string },
  ) => {
    const stageIndex = uploadStages.value.findIndex(
      (s) => s.stage === data.step,
    );
    if (stageIndex !== -1) {
      uploadStages.value[stageIndex].progress = data.progress;
    }
    uploadProgress.value = data.progress;
    uploadStage.value = data.step;
    uploadStageMessage.value = data.message;
  };

  window.ipcRenderer.on("package-progress", progressListener);

  try {
    const packageData = {
      name: formData.name,
      pkgname: formData.pkgname,
      version: formData.version,
      author: formData.author,
      contributor: formData.contributor,
      mail: formData.mail,
      website: formData.website,
      debFilePath: formData.debFilePath,
      iconPath: formData.iconPath,
      screenshots: [...formData.screenshots],
      description: formData.description,
      tags: formData.tags,
      category: formData.category,
      categoryId: formData.categoryId,
      remark: formData.remark,
      storeArch,
    };

    console.log("[Submitter] ============== PACKAGE APP ==============");
    console.log(
      "[Submitter] Package data:",
      JSON.stringify(packageData, null, 2),
    );

    const result = await window.ipcRenderer.invoke("package-app", packageData);

    if (result?.success) {
      uploadStages.value.forEach((s) => (s.progress = 100));
      uploadProgress.value = 100;
      uploadStageMessage.value = "打包完成！";
      packageSuccess.value = true;
      packageResult.value = result.data;
    } else {
      packageError.value = result?.message || "打包失败";
    }
  } catch (error) {
    packageError.value = (error as Error)?.message || "打包失败";
  } finally {
    window.ipcRenderer.off("package-progress", progressListener);
    isPackaging.value = false;
  }
};

const closeWindow = () => {
  window.ipcRenderer.send("close-submitter-window");
};

import { onMounted, onUnmounted, nextTick } from "vue";

const getGitInfo = async () => {
  try {
    const [nameResult, emailResult] = await Promise.all([
      window.ipcRenderer.invoke("get-git-name"),
      window.ipcRenderer.invoke("get-git-email"),
    ]);

    let gitName = "";
    let gitEmail = "";

    if (nameResult?.success && nameResult.data) {
      gitName = nameResult.data;
      console.log("[Submitter] Git name auto-filled:", gitName);
    }

    if (emailResult?.success && emailResult.data) {
      gitEmail = emailResult.data;
      console.log("[Submitter] Git email auto-filled:", gitEmail);
    }

    // 将 git name 和 email 合并填入 contributor 字段，格式: Name <email>
    if (gitName || gitEmail) {
      if (gitName && gitEmail) {
        formData.contributor = `${gitName} <${gitEmail}>`;
      } else if (gitName) {
        formData.contributor = gitName;
      } else if (gitEmail) {
        formData.contributor = gitEmail;
      }
    }

    // 单独填入邮箱
    if (gitEmail) {
      formData.mail = gitEmail;
    }
  } catch (err) {
    console.warn("[Submitter] Failed to get git info:", err);
  }
};

onMounted(async () => {
  console.log("[Submitter] Component mounted, loading categories and tags");
  // 透明窗口：让 body/html 背景透明，圆角才能透出，否则四角是方角。
  // 保存原始值，在 onUnmounted 中恢复，避免副作用泄漏到其它视图。
  const prevHtmlBg = document.documentElement.style.backgroundColor;
  const prevBodyBg = document.body.style.backgroundColor;
  document.documentElement.style.backgroundColor = "transparent";
  document.body.style.backgroundColor = "transparent";
  onUnmounted(() => {
    document.documentElement.style.backgroundColor = prevHtmlBg;
    document.body.style.backgroundColor = prevBodyBg;
  });
  // 先等待分类列表加载完成，避免后续竞态
  await Promise.all([loadCategoriesList(), loadTagsList()]);
  // 尝试从 git 配置读取 name 和 email，填入 contributor 和 mail
  await getGitInfo();
});
</script>

<style scoped>
.submitter-titlebar {
  -webkit-app-region: drag;
}

.submitter-close-button {
  -webkit-app-region: no-drag;
}
</style>
