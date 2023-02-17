import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let generateDisposable = vscode.commands.registerCommand(
    "generate-markdown-title-number.generate",
    disposalCallbackGenerator("generate")
  );
  context.subscriptions.push(generateDisposable);

  let deleteDisposable = vscode.commands.registerCommand(
    "generate-markdown-title-number.delete",
    disposalCallbackGenerator("delete")
  );
  context.subscriptions.push(deleteDisposable);
}

export function deactivate() {}

// 纯 ts 部分

type OpType = "generate" | "delete";

interface TitleProcessFunction {
  (lines: string[]): string[];
}

const TITLE_LINE_PATTERN = /^#+\s[\d\.]*\s*/;
const TITLE_TAG_PATTERN = /#+/;

const isTitleLine = (line: string) => {
  if (TITLE_LINE_PATTERN.test(line)) {
    return true;
  }
  return false;
};

const splitOriginTitle = (line: string) => {
  // 把前缀原有的 # 和数字都移除
  const title = line.replace(TITLE_LINE_PATTERN, "");
  // 仅截取前缀 #
  const titleTag = line.match(TITLE_TAG_PATTERN)![0];
  return { titleTag, title };
};

const generateTitleNumber = (titleTag: string, state: number[]) => {
  const titleLevel = titleTag.length - 1; // 确认当前是几级标题，例如三级标题 titleLevel = 2

  let i = 0;
  let titleNumber = "";
  while (i < titleLevel) {
    // 区间 state[0, i) 按已有状态确定序号
    titleNumber = titleNumber + "." + String(state[i++]);
  }
  // 当前最后一级标题，+1 后确定需要
  titleNumber = titleNumber + "." + String(++state[i++]);
  // 后续更低级的标题则置零，整体复杂度 O(n)
  while (i < state.length) {
    state[i++] = 0;
  }

  // 注意要去除首位拼接导致多出来的 .
  return titleNumber.substring(1);
};

/**
 * 纯 ts 函数，进行生成 markdown 文章标题操作
 * @param lines 是一个 string array
 */
const generateMarkdownTitleNumber: TitleProcessFunction = (lines: string[]) => {
  let isInCodeBlock = false;
  const state = [0, 0, 0, 0, 0, 0]; // 各级标题状态
  const newLines = [];
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];

    // 记录后续的行是否位于 ``` 代码块，避免和 python, bash 脚本的注释冲突
    if (line.startsWith("```")) {
      isInCodeBlock = !isInCodeBlock;
    }

    if (isTitleLine(line) && !isInCodeBlock) {
      const { titleTag, title } = splitOriginTitle(line);
      const titleNumber = generateTitleNumber(titleTag, state);
      const newLine = `${titleTag} ${titleNumber} ${title}`;
      newLines.push(newLine);
    } else {
      newLines.push(line);
    }
  }
  return newLines;
};

/**
 * 纯 ts 函数，进行删除 markdown 文章标题操作
 * @param lines 是一个 string array
 */
const deleteMarkdownTitleNumber: TitleProcessFunction = (lines: string[]) => {
  let isInCodeBlock = false;
  const newLines = [];
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];

    // 记录后续的行是否位于 ``` 代码块，避免和 python, bash 脚本的注释冲突
    if (line.startsWith("```")) {
      isInCodeBlock = !isInCodeBlock;
    }

    if (isTitleLine(line) && !isInCodeBlock) {
      const { titleTag, title } = splitOriginTitle(line);
      const newLine = `${titleTag} ${title}`;
      newLines.push(newLine);
    } else {
      newLines.push(line);
    }
  }
  return newLines;
};

const TITLE_PROCESS_FUN_DICT = {
  generate: generateMarkdownTitleNumber,
  delete: deleteMarkdownTitleNumber,
};

// vs 命令回调函数部分

/**
 * 高阶函数，用于根据操作类型生成 disposal 回调
 * @param type 操作类型
 * @returns
 */
const disposalCallbackGenerator = (type: OpType) => {
  return () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showInformationMessage("No open text editor");
      return;
    }

    let selection = editor.selection; // 获取选择区域
    let text = editor.document.getText(selection);

    // 没有选择区域，则默认全文
    if (text.length === 0) {
      text = editor.document.getText();
      selection = new vscode.Selection(0, 0, editor.document.lineCount, 0);
    }

    const lines = text.split("\n");
    const titleProcessFunction = TITLE_PROCESS_FUN_DICT[type];
    const newLines = titleProcessFunction(lines);

    editor.edit((builder) => {
      const newText = newLines.join("\n");
      builder.replace(
        new vscode.Range(selection.start, selection.end),
        newText
      );
    });
  };
};
