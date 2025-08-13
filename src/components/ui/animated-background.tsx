import { motion } from "framer-motion";
import React from "react";

export const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 h-full w-full bg-white">
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50"
        animate={{
          background: [
            "linear-gradient(to right, #f0f7ff, #e8eaff)",
            "linear-gradient(to right, #e8eaff, #f0f7ff)",
          ],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          repeatType: "reverse",
        }}
      />
      <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(0deg,white,transparent)]" />
    </div>
  );
};