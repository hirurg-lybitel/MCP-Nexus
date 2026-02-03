'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Card from '@/components/basic/Card';
import Button from '@/components/basic/Button';

interface PromptArgsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (args: Record<string, string>) => void;
  arguments: Array<{ name: string; description?: string; required?: boolean }>;
  promptName: string;
}

export default function PromptArgsModal({
  isOpen,
  onClose,
  onSubmit,
  arguments: promptArgs,
  promptName,
}: PromptArgsModalProps) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
    setArgs({});
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleClose]);

  const handleClickOutside = (e: React.MouseEvent) => {
    if (overlayRef.current && e.target === overlayRef.current) {
      handleClose();
    }
  };

  const handleChange = (name: string, value: string) => {
    setArgs((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateAndSubmit = () => {
    let valid = true;
    const newErrors: Record<string, string> = {};

    promptArgs.forEach(({ name, required }) => {
      if (required && (!args[name] || args[name].trim() === '')) {
        newErrors[name] = 'Required';
        valid = false;
      }
    });

    setErrors(newErrors);
    if (valid) {
      onSubmit(args);
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClickOutside}
    >
      <Card title={`Enter arguments for /${promptName}`} className="w-md max-w-full">
        <div className="space-y-4">
          {promptArgs.map(({ name, description, required }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {name} {required ? '(required)' : '(optional)'} {description ? `- ${description}` : ''}
              </label>
              <input
                type="text"
                value={args[name] || ''}
                onChange={(e) => handleChange(name, e.target.value)}
                className="w-full rounded-md bg-gray-800 border border-white/10 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors[name] && <p className="text-red-400 text-xs mt-1">{errors[name]}</p>}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={validateAndSubmit}>Submit</Button>
        </div>
      </Card>
    </div>
  );
}