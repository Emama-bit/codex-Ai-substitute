"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LeadItem, ProxyItem } from "@/types/domain";

const statusText: Record<LeadItem["status"], string> = {
  new: "新线索",
  contacted: "已联系",
  proposal: "方案沟通",
  won: "已成交",
  closed: "已关闭",
};

const statusStyle: Record<LeadItem["status"], string> = {
  new: "bg-primary/10 text-primary",
  contacted: "bg-sky-100 text-sky-700",
  proposal: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-muted",
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: LeadItem["status"]) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "更新失败");
        return;
      }
      setLeads((prev) =>
        prev.map((lead) => (lead.id === id ? data.lead : lead))
      );
    } catch {
      alert("更新失败，请重试");
    } finally {
      setUpdatingId("");
    }
  }

  async function createDemoLead() {
    setUpdatingId("demo-lead");
    try {
      const proxyRes = await fetch("/api/proxy");
      const proxyData = await proxyRes.json();
      const firstProxy = (proxyData.proxies || [])[0] as ProxyItem | undefined;

      if (!firstProxy) {
        alert("还没有可挂载的 Skill，请先发布一个 Skill 再生成演示线索");
        return;
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyId: firstProxy.id,
          skillName: firstProxy.name,
          customerName: "演示需求方 - 林小舟",
          contact: "????? / ???????",
          need: [
            `我试镜了「${firstProxy.name}」，希望真人继续协助这个需求。`,
            "",
            "我在试镜中提出的问题/材料：",
            "- 我正在做一个自由职业 AI Skill 平台，想确认详情页进入后滚动位置、试镜转化和线索承接是否顺畅。",
            "- 希望服务者帮我从产品体验、前端布局和 MVP 闭环三个角度给出优化方案。",
            "",
            "Skill AI 初步反馈重点：",
            "- 先保证需求侧能低门槛试镜，再把高意向用户引导到信任校验舱。",
            "- 线索详情页需要承接需求草稿、联系方式解锁、状态推进和报价入口。",
            "",
            "希望真人服务者继续帮我：",
            "1. 复核当前 MVP 的核心路径是否完整；",
            "2. 给出下一步前端和业务功能优先级；",
            "3. 说明报价、交付周期和需要我补充的材料。",
          ].join("\n"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "生成演示线索失败");
        return;
      }
      setLeads((prev) => [data.lead, ...prev]);
      router.push(`/leads/${data.lead.id}`);
    } catch {
      alert("生成演示线索失败，请重试");
    } finally {
      setUpdatingId("");
    }
  }

  async function unlockContact(id: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlock: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "解锁线索失败");
        return;
      }
      setLeads((prev) =>
        prev.map((lead) => (lead.id === id ? data.lead : lead))
      );
    } catch {
      alert("解锁线索失败，请重试");
    } finally {
      setUpdatingId("");
    }
  }

  const newCount = leads.filter((lead) => lead.status === "new").length;
  const contactedCount = leads.filter(
    (lead) => lead.status === "contacted"
  ).length;
  const proposalCount = leads.filter((lead) => lead.status === "proposal").length;
  const wonCount = leads.filter((lead) => lead.status === "won").length;
  const closedCount = leads.filter((lead) => lead.status === "closed").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <p className="text-sm text-primary font-medium mb-2">响应侧后台</p>
          <h1 className="text-2xl font-bold">真人服务线索</h1>
          <p className="text-sm text-muted mt-2">
            这里汇总需求侧在 Skill 详情页提交的真人服务意向。
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={createDemoLead}
            disabled={updatingId === "demo-lead"}
            className="border border-primary/30 bg-primary/10 text-primary px-4 py-2 rounded-lg hover:bg-primary/15 transition-colors text-sm text-center disabled:opacity-60"
          >
            {updatingId === "demo-lead" ? "生成中..." : "生成演示线索"}
          </button>
          <Link
            href="/create"
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm text-center"
          >
            发布新的 Skill
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
        <p className="text-sm font-medium text-amber-900">线索与收费提示</p>
        <p className="text-xs text-amber-800 mt-1 leading-relaxed">
          线索只代表需求侧表达了兴趣。MVP 阶段暂不接真实支付；后续可通过线索解锁费覆盖私聊外流风险，
          高价值服务再引导到平台托管交易，正式服务前仍需确认范围、报价、交付、隐私和责任边界。
        </p>
      </div>

      {!loading && leads.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-5">
          {[
            ["新线索", newCount],
            ["已联系", contactedCount],
            ["方案沟通", proposalCount],
            ["已成交", wonCount],
            ["已关闭", closedCount],
          ].map(([label, count]) => (
            <div key={label} className="bg-white border border-border rounded-xl p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted">加载中...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 bg-white border border-border rounded-xl">
          <p className="text-5xl mb-4">📭</p>
          <h2 className="text-xl font-semibold mb-2">暂无真人服务线索</h2>
          <p className="text-muted mb-6">
            等需求侧试用 Skill 后提交意向，这里就会出现线索。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <button
              type="button"
              onClick={createDemoLead}
              disabled={updatingId === "demo-lead"}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm disabled:opacity-60"
            >
              {updatingId === "demo-lead"
                ? "生成中..."
                : "生成一条演示线索并查看"}
            </button>
            <Link
              href="/"
              className="border border-border px-4 py-2 rounded-lg text-muted hover:text-foreground hover:bg-gray-50 transition-colors text-sm"
            >
              回到 Skill 市场
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <article
              key={lead.id}
              className="bg-white border border-border rounded-xl p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full ${statusStyle[lead.status]}`}
                    >
                      {statusText[lead.status]}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(lead.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <h2 className="font-semibold">{lead.skillName}</h2>
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-sm text-amber-900">
                      需求方：{lead.customerName}｜联系方式：
                      {lead.unlocked ? lead.contact : "线索解锁后可见"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          lead.unlocked
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {lead.unlocked ? "已解锁" : "待支付解锁费"}
                      </span>
                      {!lead.unlocked && (
                        <button
                          type="button"
                          onClick={() => unlockContact(lead.id)}
                          disabled={updatingId === lead.id}
                          className="text-xs px-3 py-1.5 rounded-full border border-amber-300 bg-white text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                        >
                          {updatingId === lead.id
                            ? "解锁中..."
                            : "模拟支付 ¥9 解锁联系方式"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/proxy/${lead.proxyId}`}
                  className="text-sm text-primary hover:underline"
                >
                  查看 Skill
                </Link>
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-sm text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  查看详情
                </Link>
              </div>
              <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs text-muted mb-1">需求说明</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {lead.need}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["new", "标记新线索"],
                    ["contacted", "标记已联系"],
                    ["proposal", "标记方案沟通"],
                    ["won", "标记已成交"],
                    ["closed", "标记已关闭"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateStatus(lead.id, status)}
                    disabled={updatingId === lead.id || lead.status === status}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      lead.status === status
                        ? "border-primary/20 bg-primary/10 text-primary cursor-default"
                        : "border-border text-muted hover:text-foreground hover:bg-gray-50"
                    } disabled:opacity-60`}
                  >
                    {updatingId === lead.id ? "更新中..." : label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
