<template>
  <div
    class="h-screen overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
  >
    <div
      class="sticky top-0 z-30 border-b border-slate-200/70 bg-white px-4 py-3 dark:border-slate-800/70 dark:bg-slate-900"
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
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          @click="closeWindow"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

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
            <div v-if="isParsingDeb || isSearchingHistory" class="flex flex-col items-center">
              <div
                class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"
              ></div>
              <p class="text-slate-600 dark:text-slate-400">
                {{ isParsingDeb ? '正在解析 deb 文件...' : '正在从服务器查询已上架信息...' }}
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
            <p v-if="formData.iconPath" class="mt-2 text-sm text-blue-500">
              {{ formData.iconPath.split("/").pop() }}
            </p>
          </div>
        </div>

        <div>
          <label
            class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >截图（最多5张）</label
          >
          <div class="grid grid-cols-5 gap-3">
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
            accept=".png,.jpg,.jpeg"
            multiple
            class="hidden"
            @change="handleScreenshotSelect"
          />
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

        <div
          v-if="submitSuccess"
          class="p-4 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/20 dark:border-green-800"
        >
          <div
            class="flex items-center gap-2 text-green-700 dark:text-green-400"
          >
            <i class="fas fa-check-circle"></i>
            <span>投稿提交成功！我们会尽快审核你的应用。</span>
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
              <div class="font-medium text-slate-900 dark:text-slate-100">
                {{ getArchDisplayName(arch.store) }}
              </div>
              <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                输出: {{ formData.pkgname }}-{{ arch.store }}.tar.gz
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
              v-for="arch in availableArchs"
              :key="arch.store"
              type="button"
              class="w-full p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-colors text-left"
              @click="selectArch(arch)"
            >
              <div class="font-medium text-slate-900 dark:text-slate-100">
                {{ getArchDisplayName(arch.store) }}
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
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";

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
  remark: "",
});

const isSubmitting = ref(false);
const submitSuccess = ref(false);
const submitError = ref("");
const isParsingDeb = ref(false);
const debParseError = ref("");
const isSearchingHistory = ref(false);
const showArchDialog = ref(false);
const availableArchs = ref<HistoryArchInfo[]>([]);
const currentDebArch = ref("");
const iconPreview = ref("");

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

// 服务器分类 id → 英文标识符映射（与后端 submitter.ts 的 categoryNameToIdMap 反向）
// 历史记录中 category 字段存储的就是这些英文标识符
const categoryIdToValueMap: Record<number, string> = {
  1: "games",
  2: "music",
  3: "network",
  4: "office",
  5: "others",
  6: "image_graphics",
  7: "development",
  8: "reading",
  9: "chat",
  10: "themes",
  11: "tools",
  12: "video",
};

interface Tag {
  name: string;
  value: string;
}

const categoriesList = ref<Category[]>([]);
const tagsList = ref<Tag[]>([]);
const selectedTags = ref<Tag[]>([]);
const selectedTagValue = ref("");

const isFormValid = computed(() => {
  return (
    formData.name.trim() &&
    formData.pkgname.trim() &&
    formData.version.trim() &&
    formData.category.trim() &&
    formData.debFilePath
  );
});

const getArchDisplayName = (store: string): string => {
  const archMap: Record<string, string> = {
    store: "AMD64 (x86_64)",
    "aarch64-store": "ARM64 (aarch64)",
    "loong64-store": "LoongArch64",
  };
  return archMap[store] || store;
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

        if (data.code === 0 && Array.isArray(data.data) && data.data.length > 0) {
          categoriesList.value = data.data.map(
            (item: { id: number; name: string }, index: number) => ({
              id: typeof item.id === "number" ? item.id : index + 1,
              // API 只返回中文 name，value 通过 id 反向映射为英文标识符
              // 英文标识符与历史记录中的 category 字段一致，用于匹配
              name: item.name || "",
              value: categoryIdToValueMap[item.id] || item.name || "",
            }),
          );
          categoriesLoadError.value = "";
          console.log("[Submitter] Categories loaded from API:", categoriesList.value);
        } else if (data.code === 0 && Array.isArray(data)) {
          categoriesList.value = data.map(
            (item: { id: number; name: string }, index: number) => ({
              id: typeof item.id === "number" ? item.id : index + 1,
              name: item.name || "",
              value: categoryIdToValueMap[item.id] || item.name || "",
            }),
          );
          categoriesLoadError.value = "";
          console.log("[Submitter] Categories loaded from API (direct array):", categoriesList.value);
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

const selectDebFile = async () => {
  const result = await window.ipcRenderer.invoke("select-deb-file");
  if (result?.success && result.filePath) {
    formData.debFilePath = result.filePath;
    await parseDebFileAndSearchHistory(result.filePath);
  }
};

const useMirror = ref(true);

const searchHistoryApp = async () => {
  console.log(
    "[Submitter] ============== SEARCHING HISTORY INFO ==============",
  );
  console.log(
    "[Submitter] pkgname is not empty, searching history with:",
    formData.pkgname,
  );
  console.log("[Submitter] Using mirror:", useMirror.value);

  console.log(
    "[Submitter] Calling IPC: search-history-app with pkgname:",
    formData.pkgname,
  );
  const historyResult = await window.ipcRenderer.invoke(
    "search-history-app",
    formData.pkgname,
    useMirror.value,
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
    console.log(
      "[Submitter] ============== HISTORY INFO FOUND ==============",
    );
    console.log(
      "[Submitter] History info count:",
      historyResult.data.length,
    );
    console.log(
      "[Submitter] Available archs data:",
      JSON.stringify(historyResult.data, null, 2),
    );

    console.log(
      "[Submitter] ============== BEFORE SETTING STATE ==============",
    );
    console.log(
      "[Submitter] availableArchs before:",
      availableArchs.value,
    );
    console.log(
      "[Submitter] showArchDialog before:",
      showArchDialog.value,
    );

    // 按 amd64 → arm64 → loong64 顺序排序
    const archOrder: Record<string, number> = {
      store: 0,
      "aarch64-store": 1,
      "loong64-store": 2,
    };
    availableArchs.value = [...historyResult.data].sort(
      (a, b) => (archOrder[a.store] ?? 99) - (archOrder[b.store] ?? 99),
    );
    console.log(
      "[Submitter] availableArchs after:",
      availableArchs.value,
    );
    console.log(
      "[Submitter] availableArchs length:",
      availableArchs.value.length,
    );

    // 确保分类列表已加载，避免 select 无法回显
    if (categoriesList.value.length === 0) {
      await loadCategoriesList();
    }

    // 从第一条历史记录预填名称和分类
    const firstArch = historyResult.data[0];
    if (firstArch) {
      formData.name = firstArch.name || formData.name;
      formData.category = firstArch.category || formData.category;
    }

    showArchDialog.value = true;
    console.log(
      "[Submitter] showArchDialog after:",
      showArchDialog.value,
    );

    console.log(
      "[Submitter] ============== DIALOG SHOULD BE SHOWING ==============",
    );
    console.log("[Submitter] Dialog visibility:", showArchDialog.value);
    console.log(
      "[Submitter] Available architectures to display:",
      availableArchs.value.map((a) => a.store),
    );

    nextTick(() => {
      console.log(
        "[Submitter] ============== AFTER NEXT TICK ==============",
      );
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
    console.log(
      "[Submitter] historyResult.success:",
      historyResult?.success,
    );
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
  }
};

const parseDebFileAndSearchHistory = async (debPath: string) => {
  isParsingDeb.value = true;
  debParseError.value = "";

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

      const textUriList = event.dataTransfer?.getData("text/uri-list");
      console.log("[Submitter] text/uri-list:", textUriList);

      const textPlain = event.dataTransfer?.getData("text/plain");
      console.log("[Submitter] text/plain:", textPlain);

      const filePath = file.path || textUriList || textPlain;
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
  formData.contributor = arch.contributor || formData.contributor;
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

  const baseUrl = useMirror.value
    ? `https://mirrors.sdu.edu.cn/spark-store/${arch.store}/${arch.category}/${arch.pkgname}`
    : `https://spk-json.spark-app.store/${arch.store}/${arch.category}/${arch.pkgname}`;

  console.log(
    "[Submitter] Building icon and screenshot URLs with baseUrl:",
    baseUrl,
  );

  if (arch.icon) {
    formData.iconPath = `${baseUrl}/icon.png`;
    iconPreview.value = formData.iconPath;
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

const handleIconFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0] as File & { path?: string };
  if (file) {
    formData.iconPath = file.path || file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      iconPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const handleIconDrop = (event: DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0] as File & { path?: string };
  if (
    file &&
    (file.name.endsWith(".png") ||
      file.name.endsWith(".jpg") ||
      file.name.endsWith(".jpeg"))
  ) {
    formData.iconPath = file.path || file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      iconPreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const addScreenshot = () => {
  screenshotInput.value?.click();
};

const handleScreenshotSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (files) {
    for (let i = 0; i < files.length && formData.screenshots.length < 5; i++) {
      const file = files[i];
      if (
        file.name.endsWith(".png") ||
        file.name.endsWith(".jpg") ||
        file.name.endsWith(".jpeg")
      ) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (formData.screenshots.length < 5) {
            formData.screenshots.push(e.target?.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  }
  target.value = "";
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
  formData.remark = "";
  submitSuccess.value = false;
  submitError.value = "";
  debParseError.value = "";
  packageSuccess.value = false;
  packageError.value = "";
  packageResult.value = null;
};

const submitForm = async () => {
  if (!isFormValid.value) return;

  isSubmitting.value = true;
  submitSuccess.value = false;
  submitError.value = "";

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
      remark: formData.remark,
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
      submitSuccess.value = true;
      resetForm();
    } else {
      submitError.value = result?.message || "提交失败";
    }
  } catch (error) {
    submitError.value = (error as Error)?.message || "提交失败";
  } finally {
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
      packageSuccess.value = true;
      packageResult.value = result.data;
    } else {
      packageError.value = result?.message || "打包失败";
    }
  } catch (error) {
    packageError.value = (error as Error)?.message || "打包失败";
  } finally {
    isPackaging.value = false;
  }
};

const closeWindow = () => {
  window.ipcRenderer.send("close-submitter-window");
};

import { onMounted, nextTick } from "vue";

const getGitEmail = async () => {
  try {
    const result = await window.ipcRenderer.invoke("get-git-email");
    if (result?.success && result.data) {
      formData.mail = result.data;
      console.log("[Submitter] Git email auto-filled:", result.data);
    }
  } catch (err) {
    console.warn("[Submitter] Failed to get git email:", err);
  }
};

onMounted(async () => {
  console.log("[Submitter] Component mounted, loading categories and tags");
  // 先等待分类列表加载完成，避免后续竞态
  await Promise.all([loadCategoriesList(), loadTagsList()]);
  // 尝试从 git 配置读取邮箱
  await getGitEmail();
});
</script>
