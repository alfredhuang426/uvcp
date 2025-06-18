'use client'
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState, Suspense } from 'react';
import Dropzone from './Dropzone';
import { useSearchParams } from 'next/navigation';

const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1000MB

// 新增 SearchParamsWrapper 組件
const SearchParamsWrapper: React.FC<{ children: (componentId: string | null) => React.ReactNode }> = ({ children }) => {
  const searchParams = useSearchParams();
  const componentId = searchParams.get('componentId');
  return <>{children(componentId)}</>;
};

const VideoCompressorContent: React.FC<{ componentId: string | null }> = ({ componentId }) => {
  const t = useTranslations('VideoCompressor');
  const [inputVideo, setInputVideo] = useState<File | null>(null);
  const [outputVideo, setOutputVideo] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [compressing, setCompressing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressionTime: number;
  } | null>(null);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef<FFmpeg>();

  useEffect(() => {
    if (typeof window !== 'undefined' && !ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
      load();
    }
    return () => {
      // Cleanup URLs when component unmounts
      if (outputVideo) {
        URL.revokeObjectURL(outputVideo);
      }
    };
  }, []);

  const load = async () => {
    if (!ffmpegRef.current) return;
    
    const ffmpegInstance = ffmpegRef.current;

    try {
      ffmpegInstance.on('progress', ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });
      
      ffmpegInstance.on("log", ({ message }) => {
        setLogMessages(prev => [...prev, message]);
      });

      // Load FFmpeg using the built-in loading mechanism
      await ffmpegInstance.load();

      setLoaded(true);
      setError(null);
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      setError('Failed to load FFmpeg. Please refresh the page and try again.');
      setLoaded(false);
    }
  };

  const compress = async () => {
    if (!loaded) {
      setError('FFmpeg is not loaded. Please wait or refresh the page.');
      return;
    }

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !inputVideo) return;

    setCompressing(true);
    setError(null);
    setLogMessages([]);
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    try {
      const startTime = Date.now();
      await ffmpeg.writeFile(inputFileName, await fetchFile(inputVideo));

      await ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-tag:v', 'avc1',
        '-movflags', 'faststart',
        '-crf', '26',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-vf', 'scale=-2:720',
        '-r', '15',
        '-threads', '0',
        '-x264opts', 'no-cabac:ref=0:weightp=0:8x8dct=0',
        '-progress', '-',
        '-v', '',
        '-y',
        outputFileName
      ]);

      const endTime = Date.now();
      const compressionTime = (endTime - startTime) / 1000; // 秒

      const data = await ffmpeg.readFile(outputFileName);
      if (!(data instanceof Uint8Array)) {
        throw new Error('Unexpected data type from FFmpeg');
      }

      // Cleanup previous URL if exists
      if (outputVideo) {
        URL.revokeObjectURL(outputVideo);
      }

      const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      setOutputVideo(url);

      // Calculate compression stats
      const originalSize = inputVideo.size;
      const compressedSize = data.byteLength;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      setCompressionStats({
        originalSize,
        compressedSize,
        compressionRatio,
        compressionTime
      });

      window.parent.postMessage({
        type: 'VIDEO_COMPRESSED',
        componentId: componentId,
        file: new File([data], 'compressed-video.mp4', { type: 'video/mp4' }),
        filename: inputVideo.name,
        stats: {
          originalSize,
          compressedSize,
          compressionRatio,
          compressionTime
        }
      }, '*');
    } catch (error) {
      const err = error as Error;
      if (err.message === 'Compression cancelled by user.') {
        setError('已取消壓縮');
        setCompressing(false);
        setInputVideo(null);
        return;
      } else {
        console.error('Error compressing video:', error);
        setError('Failed to compress video. Please try again.');
      }
    } finally {
      setCompressing(false);
    }
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;
    if (file.type.startsWith('image/')) {
      // 直接傳送圖片
      window.parent.postMessage({
        type: 'IMAGE_SELECTED',
        componentId: componentId,
        file: new File([await file.arrayBuffer()], file.name, { type: file.type }),
        filename: file.name
      }, '*');
      setInputVideo(null);
    } else if (file.type.startsWith('video/')) {
      setInputVideo(file);
    } else {
      setError('只支援 mp4 影片或常見圖片格式');
    }
  };

  useEffect(() => {
    if (inputVideo && inputVideo.type.startsWith('video/')) {
      compress();
    }
  }, [inputVideo]);

  const handleCancel = () => {
    window.location.reload();
  };

  return (
    <div>
      <div>
        {
          !compressing && <Dropzone
          onChange={handleFileChange}
          className="w-full"
          fileExtension="mp4"
        />
        }
      </div>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {compressing && (
        <div>
          <div className="relative pt-1">
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200 dark:bg-blue-700">
              <div style={{ width: `${progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 dark:bg-blue-400 transition-all duration-300"></div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">{t('compressingProgress', { progress })}</p>
        </div>
      )}
      {compressing && (
        <button
          onClick={handleCancel}
          className="w-full py-3 px-4 rounded-md text-white font-semibold bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors duration-200"
        >
          取消壓縮
        </button>
      )}
    </div>
  );
};

const VideoCompressor: React.FC = () => {
  return (
    <Suspense fallback={<div>載入中...</div>}>
      <SearchParamsWrapper>
        {(componentId) => <VideoCompressorContent componentId={componentId} />}
      </SearchParamsWrapper>
    </Suspense>
  );
};

export default VideoCompressor;