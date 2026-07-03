import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Tag,
  History,
  CalendarRange,
  Receipt,
  X,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { format } from "date-fns";
import { PageContainer } from "@/components/layout/PageContainer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WalletTransaction {
  id: number;
  userId: number;
  amount: string;
  type: "credit" | "debit";
  referenceType?: string | null;
  referenceId?: number | null;
  description?: string | null;
  createdAt: string;
}

interface RechargeTransaction extends WalletTransaction {
  paymentMethod: string;
  transactionId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWalletQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to)   params.set("to", to);
  const qs = params.toString();
  return `/wallet/balance${qs ? `?${qs}` : ""}`;
}

function buildRechargeQuery(from: string, to: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to)   params.set("to", to);
  const qs = params.toString();
  return `/wallet/recharge-history${qs ? `?${qs}` : ""}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DateRangeFilter({
  from, to, onChange, onClear,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  onClear: () => void;
}) {
  const hasFilter = from || to;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="h-8 w-36 text-sm"
        aria-label="Filter from date"
        id="wallet-filter-from"
      />
      <span className="text-muted-foreground text-sm">→</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="h-8 w-36 text-sm"
        aria-label="Filter to date"
        id="wallet-filter-to"
      />
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          aria-label="Clear date filter"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.type === "credit";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-4 rounded-lg border bg-card gap-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0 overflow-hidden">
        <div
          className={`p-2 rounded-full shrink-0 ${
            isCredit
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {isCredit ? (
            <ArrowUpRight className="h-5 w-5" />
          ) : (
            <ArrowDownRight className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {tx.description || (isCredit ? "Credit" : "Debit")}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
          </p>
        </div>
      </div>
      <div
        className={`font-bold shrink-0 ${
          isCredit
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        }`}
      >
        {isCredit ? "+" : "-"}
        {parseFloat(tx.amount).toFixed(2)} LYD
      </div>
    </motion.div>
  );
}

function RechargeRow({ tx }: { tx: RechargeTransaction }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start justify-between p-4 rounded-lg border bg-card gap-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-4 min-w-0 overflow-hidden">
        <div className="p-2 rounded-full shrink-0 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
          <ArrowUpRight className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {tx.description || "Wallet Recharge"}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <p className="text-xs text-muted-foreground">
              {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
            </p>
            <span className="text-xs text-muted-foreground">·</span>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{tx.paymentMethod}</span>
            </p>
            <span className="text-xs text-muted-foreground">·</span>
            <p className="text-xs font-mono text-muted-foreground">{tx.transactionId}</p>
          </div>
        </div>
      </div>
      <div className="font-bold shrink-0 text-green-600 dark:text-green-400">
        +{parseFloat(tx.amount).toFixed(2)} LYD
      </div>
    </motion.div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <WalletIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
      <p className="font-medium">{message}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveTab = "all" | "recharge";

export default function Wallet() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo,   setFilterTo]   = useState("");
  const api = useApi();

  // All transactions (balance + transaction list)
  const {
    data: walletData,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ["wallet-balance", filterFrom, filterTo],
    queryFn: () => api.get(buildWalletQuery(filterFrom, filterTo)),
  });

  // Referral code (lazily generated server-side)
  const { data: referralData } = useQuery({
    queryKey: ["referral-code"],
    queryFn: () => api.get("/coupons/referral/my-code"),
  });

  // Recharge-only transactions
  const {
    data: rechargeData,
    isLoading: rechargeLoading,
    refetch: refetchRecharge,
  } = useQuery({
    queryKey: ["wallet-recharge-history", filterFrom, filterTo],
    queryFn: () => api.get(buildRechargeQuery(filterFrom, filterTo)),
    enabled: activeTab === "recharge",
  });

  const refetchAll = () => {
    refetchWallet();
    if (activeTab === "recharge") refetchRecharge();
  };

  const { mutate: redeem, isPending: isRedeeming } = useMutation({
    mutationFn: (data: { code: string }) =>
      api.post("/payments/redeem-code", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description:
          "Prepaid card redeemed successfully! Your balance has been updated.",
      });
      setCode("");
      refetchAll();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to redeem card",
        variant: "destructive",
      });
    },
  });

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    redeem({ code: code.trim() });
  };

  const handleDateChange = (from: string, to: string) => {
    setFilterFrom(from);
    setFilterTo(to);
  };

  const handleDateClear = () => {
    setFilterFrom("");
    setFilterTo("");
  };

  if (walletLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const balance = parseFloat(walletData?.balance || "0.00").toFixed(2);
  const transactions: WalletTransaction[] = walletData?.transactions || [];
  const recharges: RechargeTransaction[] = rechargeData?.recharges || [];
  const hasFilter = filterFrom || filterTo;

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2">My Wallet</h1>
          <p className="text-muted-foreground">
            Manage your balance, redeem prepaid cards, and view transaction history.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* ── Left Column ── */}
          <div className="md:col-span-1 space-y-6">
            {/* Balance Card */}
            <Card className="bg-primary text-primary-foreground overflow-hidden relative">
              <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                <WalletIcon size={200} />
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <WalletIcon className="h-5 w-5" /> Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-bold mb-2">
                  {balance}{" "}
                  <span className="text-2xl opacity-80">LYD</span>
                </div>
                <p className="opacity-80 text-sm">
                  Available for courses and tutoring
                </p>
              </CardContent>
            </Card>

            {/* Redeem Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Redeem Prepaid Card
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRedeem} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="code" className="text-sm font-medium">
                      Card Code
                    </label>
                    <Input
                      id="code"
                      placeholder="e.g. XXXX-XXXX-XXXX-XXXX"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="font-mono"
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!code.trim() || isRedeeming}
                    id="wallet-redeem-btn"
                  >
                    {isRedeeming ? "Redeeming…" : "Redeem Now"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Referral code */}
            {referralData?.code && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-bold mb-1">🎁 Invite friends, earn credit</p>
                  <p className="text-xs text-muted-foreground mb-3">{referralData.message}</p>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-center font-mono font-bold tracking-widest">
                      {referralData.code}
                    </code>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard?.writeText(referralData.code);
                        toast({ title: "Referral code copied!" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            {transactions.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-2 gap-3"
              >
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total In</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    +
                    {transactions
                      .filter((t) => t.type === "credit")
                      .reduce((s, t) => s + parseFloat(t.amount), 0)
                      .toFixed(2)}{" "}
                    <span className="text-xs">LYD</span>
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Out</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    -
                    {transactions
                      .filter((t) => t.type === "debit")
                      .reduce((s, t) => s + parseFloat(t.amount), 0)
                      .toFixed(2)}{" "}
                    <span className="text-xs">LYD</span>
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Right Column ── */}
          <div className="md:col-span-2">
            <Card className="h-full flex flex-col">
              {/* Tab Bar */}
              <CardHeader className="pb-0">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-1 border-b border-border">
                    <button
                      id="wallet-tab-all"
                      onClick={() => setActiveTab("all")}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === "all"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Tag className="h-4 w-4" />
                      All Transactions
                      {transactions.length > 0 && (
                        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {transactions.length}
                        </span>
                      )}
                    </button>
                    <button
                      id="wallet-tab-recharge"
                      onClick={() => setActiveTab("recharge")}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        activeTab === "recharge"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <History className="h-4 w-4" />
                      Recharge History
                    </button>
                  </div>

                  {/* Date Filter */}
                  <DateRangeFilter
                    from={filterFrom}
                    to={filterTo}
                    onChange={handleDateChange}
                    onClear={handleDateClear}
                  />
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-auto pt-4">
                <AnimatePresence mode="wait">
                  {/* ── All Transactions Tab ── */}
                  {activeTab === "all" && (
                    <motion.div
                      key="all"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {transactions.length === 0 ? (
                        <EmptyState
                          message={
                            hasFilter
                              ? "No transactions in this date range."
                              : "No transactions found."
                          }
                          sub={
                            hasFilter
                              ? "Try adjusting the date filter."
                              : "Redeem a prepaid card to get started!"
                          }
                        />
                      ) : (
                        <div className="space-y-3">
                          {transactions.map((tx) => (
                            <TransactionRow key={tx.id} tx={tx} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── Recharge History Tab ── */}
                  {activeTab === "recharge" && (
                    <motion.div
                      key="recharge"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {rechargeLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                      ) : recharges.length === 0 ? (
                        <EmptyState
                          message={
                            hasFilter
                              ? "No recharges in this date range."
                              : "No recharge history yet."
                          }
                          sub={
                            hasFilter
                              ? "Try adjusting the date filter."
                              : "Your prepaid card redemptions will appear here."
                          }
                        />
                      ) : (
                        <div className="space-y-3">
                          {/* Header row */}
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                            <Receipt className="h-3.5 w-3.5" />
                            {recharges.length} recharge
                            {recharges.length !== 1 ? "s" : ""}
                            {hasFilter ? " (filtered)" : ""}
                          </div>
                          {recharges.map((tx) => (
                            <RechargeRow key={tx.id} tx={tx} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
