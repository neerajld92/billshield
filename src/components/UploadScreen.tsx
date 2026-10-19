import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { Bill, Charge } from '../types';

interface UploadScreenProps {
  onBillExtracted: (bill: Bill, charges: Charge[], fileDataUrl?: string) => void;
  onOpenPrivacy: () => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  onBackToLanding: () => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
  onBillExtracted,
  onOpenPrivacy,
  isLoading,
  setIsLoading,
  onBackToLanding,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [serviceHint, setServiceHint] = useState<string>('');
  const [expectedAmountInput, setExpectedAmountInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File) => {
    setErrorMessage(null);

    // Validate size (10 MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Choose a file under 10 MB with no more than 10 PDF pages.');
      return;
    }

    // Validate type (by MIME or file extension)
    const fileNameLower = (selectedFile.name || '').toLowerCase();
    const isPdf = selectedFile.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
    const isImg =
      selectedFile.type.startsWith('image/') ||
      fileNameLower.endsWith('.jpg') ||
      fileNameLower.endsWith('.jpeg') ||
      fileNameLower.endsWith('.png') ||
      fileNameLower.endsWith('.webp');

    if (!isPdf && !isImg) {
      setErrorMessage('Choose a PDF, JPG or PNG.');
      return;
    }

    setFile(selectedFile);

    // Read as Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileDataUrl((e.target?.result as string) || '');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleSubmit = async () => {
    if (!file || !fileDataUrl) {
      setErrorMessage('Please choose or drop a bill file to continue.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const resolvedMime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    try {
      const response = await fetch('/api/extract-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: fileDataUrl,
          mimeType: resolvedMime,
          fileName: file.name,
          service: serviceHint.trim() || undefined,
          expectedAmount: expectedAmountInput.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'We couldn’t read this clearly. Try a clearer image or another file.');
      }

      const data = await response.json();
      if (!data.bill || !Array.isArray(data.charges)) {
        throw new Error('Invalid bill structure received from AI service.');
      }

      const fullBill: Bill = {
        ...data.bill,
        fileDataUrl,
        fileMimeType: resolvedMime,
        originalAvailable: true,
      };

      onBillExtracted(fullBill, data.charges, fileDataUrl);
    } catch (err: any) {
      console.warn('Bill extraction notice:', err?.message);
      setErrorMessage(err.message || 'We couldn’t read this clearly. Try a clearer image or another file.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Back to landing */}
      <button
        type="button"
        onClick={onBackToLanding}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-mono text-[#555B55] hover:text-[#20221F] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to overview</span>
      </button>

      {/* Headings (Matching Image 1.jpeg) */}
      <div className="text-center sm:text-left mb-6">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#20221F]">
          Make sense of your bill.
        </h1>
        <p className="mt-2 text-base text-[#555B55]">
          See what you were charged and ask about anything unclear.
        </p>
      </div>

      {/* AI Processing & Privacy Notice */}
      <div className="mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-4 text-xs text-[#20221F] flex items-start gap-3 shadow-2xs">
        <ShieldCheck className="h-5 w-5 text-[#2546C4] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span>
            Your bill will be sent to our AI service to read and explain it. Saving a review is optional.
          </span>
          <br />
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="mt-1 font-medium text-[#2546C4] underline underline-offset-2 hover:text-[#1C369B] cursor-pointer"
          >
            Privacy & processing details
          </button>
        </div>
      </div>

      {/* Upload Box (Matching Image 1.jpeg) */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative mb-6 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-all cursor-pointer bg-[#FFFDF7] ${
          isDragOver
            ? 'border-[#2546C4] bg-[#F0F4FF]'
            : 'border-[#D8D3C8] hover:border-[#777B73]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileChange(e.target.files[0]);
            }
          }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF1E8] text-[#285840]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="font-mono text-sm font-bold text-[#20221F] max-w-md truncate">
              {file.name}
            </div>
            <div className="text-xs text-[#555B55]">
              {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'Document'}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-2 text-xs font-mono font-medium text-[#2546C4] underline hover:text-[#1C369B]"
            >
              Replace file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF1E8] text-[#285840]">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-block rounded-md bg-[#ECE8DE] px-3 py-1 font-mono text-xs font-bold text-[#20221F] mr-2">
                Choose a bill
              </span>
              <span className="text-xs text-[#555B55]">or drag and drop here</span>
            </div>
            <p className="text-[11px] text-[#777B73]">
              PDF, JPG or PNG · Up to 10 MB · Up to 10 pages
            </p>
          </div>
        )}
      </div>

      {/* Form Fields Card */}
      <div className="mb-6 rounded-lg border border-[#D8D3C8] bg-[#FFFDF7] p-5 space-y-4">
        {/* Service Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="service-input" className="font-mono text-xs font-bold text-[#20221F]">
              Service (optional)
            </label>
            <span className="text-[11px] text-[#777B73]">Context helps accuracy</span>
          </div>
          <input
            id="service-input"
            type="text"
            value={serviceHint}
            onChange={(e) => setServiceHint(e.target.value)}
            placeholder="e.g., Mobile, Broadband, Utility"
            className="w-full rounded-md border border-[#D8D3C8] bg-[#F4F4EF] px-3.5 py-2.5 text-sm text-[#20221F] placeholder-[#777B73] focus:border-[#2546C4] focus:bg-white focus:outline-hidden transition-colors"
          />
        </div>

        {/* Expected Amount Field */}
        <div>
          <label htmlFor="expected-amount-input" className="block font-mono text-xs font-bold text-[#20221F] mb-1.5">
            What amount did you expect? (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-[#777B73]">
              ₹
            </span>
            <input
              id="expected-amount-input"
              type="text"
              value={expectedAmountInput}
              onChange={(e) => setExpectedAmountInput(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-[#D8D3C8] bg-[#F4F4EF] pl-8 pr-3.5 py-2.5 font-mono text-sm font-semibold text-[#20221F] placeholder-[#777B73] focus:border-[#2546C4] focus:bg-white focus:outline-hidden transition-colors"
            />
          </div>
          <span className="block mt-1 text-[11px] text-[#777B73]">Leave blank if you're not sure.</span>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 rounded-lg border border-[#F5C2C2] bg-[#FBECEC] p-4 text-xs text-[#A12D2D] flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
            <p className="mt-1 text-[11px]">Check the file and try again.</p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        disabled={isLoading || !file}
        onClick={handleSubmit}
        className={`w-full flex items-center justify-center gap-2 rounded-lg py-3.5 px-6 font-mono text-xs font-bold uppercase tracking-wider text-white transition-all ${
          isLoading || !file
            ? 'bg-[#2546C4]/60 cursor-not-allowed'
            : 'bg-[#2546C4] hover:bg-[#1C369B] active:translate-y-0.5 shadow-sm cursor-pointer'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Reading your bill…</span>
          </>
        ) : (
          <>
            <span>Understand my bill</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
};
