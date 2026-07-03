import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, CreditCard, Tag } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { format } from "date-fns";

export default function Wallet() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const api = useApi();

  const { data: walletData, isLoading, refetch } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => api.get('/wallet/balance'),
  });

  const { mutate: redeem, isPending: isRedeeming } = useMutation({
    mutationFn: (data: { code: string }) => api.post('/payments/redeem-code', data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prepaid card redeemed successfully! Your balance has been updated.",
      });
      setCode("");
      refetch();
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

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const balance = parseFloat(walletData?.balance || "0.00").toFixed(2);
  const transactions = walletData?.transactions || [];

  return (
    <div className="container mx-auto px-4 py-8">
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
        {/* Balance Card */}
        <div className="md:col-span-1 space-y-8">
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
              <div className="text-5xl font-bold mb-2">{balance} <span className="text-2xl opacity-80">LYD</span></div>
              <p className="opacity-80 text-sm">Available for courses and tutoring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Redeem Prepaid Card
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRedeem} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">Card Code</label>
                  <Input
                    id="code"
                    placeholder="e.g. XXXX-XXXX-XXXX-XXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={!code.trim() || isRedeeming}>
                  {isRedeeming ? "Redeeming..." : "Redeem Now"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" /> Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <WalletIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No transactions found.</p>
                  <p className="text-sm mt-1">Redeem a prepaid card to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${tx.type === 'credit' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {tx.type === 'credit' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{tx.description || (tx.type === 'credit' ? 'Credit' : 'Debit')}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${tx.type === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {tx.type === 'credit' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} LYD
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
