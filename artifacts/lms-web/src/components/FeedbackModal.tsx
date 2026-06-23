import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  title: string;
  subtitle: string;
  /** Optional second rating label (e.g. for live sessions: "Technical Quality") */
  secondRatingLabel?: string;
  onSubmitSecondRating?: (rating: number) => void;
}

function StarPicker({
  value,
  onChange,
  size = 'lg',
}: {
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (hovered || value) >= star;
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className={`${dim} transition-all duration-150 hover:scale-110 active:scale-95`}
          >
            <Star
              className={`${dim} transition-colors duration-150 ${
                active
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent!',
};

export function FeedbackModal({
  open,
  onClose,
  onSubmit,
  title,
  subtitle,
  secondRatingLabel,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setIsSubmitting(true);
    try {
      await onSubmit(rating, comment);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setTimeout(() => {
      setRating(0);
      setComment('');
      setSubmitted(false);
    }, 300);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] rounded-2xl overflow-hidden p-0 gap-0">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 px-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <span className="text-3xl">🎉</span>
              </div>
              <h3 className="text-xl font-bold mb-2">Thank you!</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Your feedback helps improve the platform for everyone.
              </p>
              <Button onClick={handleClose} className="w-full rounded-xl">
                Close
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Header gradient */}
              <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b border-border">
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Primary star rating */}
                <div className="flex flex-col items-center gap-3">
                  <StarPicker value={rating} onChange={setRating} size="lg" />
                  <AnimatePresence>
                    {rating > 0 && (
                      <motion.p
                        key={rating}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-semibold text-amber-500"
                      >
                        {RATING_LABELS[rating]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Comment textarea — appears after rating is chosen */}
                <AnimatePresence>
                  {rating > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        placeholder="Share your experience (optional)..."
                        className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="ghost"
                    className="flex-1 text-muted-foreground hover:text-foreground rounded-xl"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Skip for now
                  </Button>
                  <Button
                    className="flex-1 rounded-xl"
                    onClick={handleSubmit}
                    disabled={!rating || isSubmitting}
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
