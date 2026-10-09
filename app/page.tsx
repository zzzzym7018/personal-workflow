import type { Metadata } from "next";
import { AccessError, getViewer, requireAllowedViewer } from "./lib/server-auth";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { WorkspaceApp } from "./workspace/WorkspaceApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "今日",
  description: "个人日程、项目与领域学习工作台",
};

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <main className="access-page">
        <section className="access-panel" aria-labelledby="access-title">
          <span className="access-mark" aria-hidden="true">知</span>
          <p className="eyebrow">PRIVATE WORKSPACE</p>
          <h1 id="access-title">进入知行台</h1>
          <p>这是一个私人日程、项目和领域学习工作台。登录后才能查看其中的数据。</p>
          <a className="button button--primary button--large" href={chatGPTSignInPath("/")}>使用 ChatGPT 登录</a>
        </section>
      </main>
    );
  }

  let allowedViewer;
  try {
    allowedViewer = await requireAllowedViewer();
  } catch (error) {
    const message = error instanceof AccessError ? error.message : "站点暂时无法打开。";
    return (
      <main className="access-page">
        <section className="access-panel" aria-labelledby="access-denied-title">
          <span className="access-mark access-mark--warning" aria-hidden="true">止</span>
          <p className="eyebrow">PRIVATE ACCESS</p>
          <h1 id="access-denied-title">无法访问这个工作台</h1>
          <p>{message}</p>
          <a className="button button--outline button--large" href={chatGPTSignOutPath("/")}>换一个账号登录</a>
        </section>
      </main>
    );
  }

  return <WorkspaceApp initialViewer={{ displayName: allowedViewer.displayName, email: allowedViewer.email, isPreview: allowedViewer.isPreview }} />;
}
