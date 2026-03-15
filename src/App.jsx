import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, KeyRound, Music, FolderOpen, AlertCircle, Loader2, Shuffle } from 'lucide-react';

export default function App() {
  // นำ API Key ของคุณมาตั้งเป็นค่าเริ่มต้น
  const DEFAULT_API_KEY = 'AIzaSyCh32717F0Lyz2wBlvDeT6r4SoyBhmVoPQ';
  
  const [apiKey, setApiKey] = useState(localStorage.getItem('gdrive_api_key') || DEFAULT_API_KEY);
  const [isKeySaved, setIsKeySaved] = useState(true); // ตั้งเป็น true เพื่อให้ข้ามหน้ากรอกรหัสไปเลย
  const [files, setFiles] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false); // สถานะเปิด/ปิดการสุ่มเพลง
  
  const audioRef = useRef(null);
  
  // โฟลเดอร์ ID ของคุณที่ให้มา
  const FOLDER_ID = '1hcHe4ey293TD9RQRmxTZmqZNR8zs8A2t';

  useEffect(() => {
    if (isKeySaved && apiKey) {
      fetchMusicFiles();
    }
  }, [isKeySaved]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => setProgress(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => playNext();

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, files, isShuffle]); // เพิ่ม isShuffle เข้าไปใน dependency

  useEffect(() => {
    if (audioRef.current && currentTrackIndex >= 0) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error("Autoplay prevented:", e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrackIndex]);

  const saveApiKey = () => {
    if (!apiKey.trim()) {
      setError('กรุณาใส่ API Key');
      return;
    }
    localStorage.setItem('gdrive_api_key', apiKey.trim());
    setIsKeySaved(true);
    setError('');
  };

  const clearApiKey = () => {
    localStorage.removeItem('gdrive_api_key');
    setApiKey('');
    setIsKeySaved(false);
    setFiles([]);
    setCurrentTrackIndex(-1);
    setIsPlaying(false);
  };

  const fetchMusicFiles = async () => {
    setLoading(true);
    setError('');
    try {
      // ค้นหาไฟล์ audio ในโฟลเดอร์
      const query = `'${FOLDER_ID}' in parents and mimeType contains 'audio/'`;
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${apiKey}&fields=files(id,name,mimeType)`);
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }
      
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
      } else {
        setError('ไม่พบไฟล์เสียงในโฟลเดอร์นี้ หรือโฟลเดอร์ไม่ได้เปิดเป็นสาธารณะ');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const playTrack = (index) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (currentTrackIndex === -1 && files.length > 0) {
      if (isShuffle) {
        const randomIndex = Math.floor(Math.random() * files.length);
        playTrack(randomIndex);
      } else {
        playTrack(0);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (files.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
      // สุ่มเพลงใหม่
      nextIndex = Math.floor(Math.random() * files.length);
      // ป้องกันการสุ่มได้เพลงเดิมซ้ำ ถ้ามีเพลงมากกว่า 1 เพลง
      if (files.length > 1 && nextIndex === currentTrackIndex) {
        nextIndex = (nextIndex + 1) % files.length;
      }
    } else {
      // เล่นเพลงถัดไปตามปกติ
      nextIndex = (currentTrackIndex + 1) % files.length;
    }
    
    playTrack(nextIndex);
  };

  const playPrev = () => {
    if (files.length === 0) return;
    
    // สำหรับปุ่มย้อนกลับ ปกติถ้าเปิด shuffle อาจจะสุ่มใหม่ หรือถอยหลังไปเพลงก่อนหน้าจริงๆ 
    // เพื่อความเรียบง่าย เราจะให้ย้อนกลับตามลำดับ index ปกติ แม้จะเปิด Shuffle อยู่
    const prevIndex = currentTrackIndex <= 0 ? files.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getStreamUrl = (fileId) => {
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="p-6 text-center border-b border-neutral-800">
        <h1 className="text-2xl font-bold text-green-400 flex items-center justify-center gap-2">
          <Music size={28} />
          My Drive Player
        </h1>
        <p className="text-neutral-400 text-sm mt-1 flex items-center justify-center gap-1">
          <FolderOpen size={14} /> ID: {FOLDER_ID.substring(0, 8)}...
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 max-w-lg w-full mx-auto pb-32">
        {!isKeySaved ? (
          <div className="bg-neutral-800 p-6 rounded-2xl shadow-lg mt-8 border border-neutral-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <KeyRound className="text-yellow-400" /> ตั้งค่า API Key
            </h2>
            <p className="text-sm text-neutral-300 mb-4 leading-relaxed">
              เพื่อดึงเพลงจาก Google Drive คุณต้องใส่ Google Drive API Key ของคุณ
              และอย่าลืมตั้งค่าโฟลเดอร์ให้เป็น <strong>"ทุกคนที่มีลิงก์ (Anyone with the link)"</strong>
            </p>
            <input
              type="text"
              placeholder="ใส่ API Key ที่นี่..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-green-500 text-white"
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <button
              onClick={saveApiKey}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              บันทึกและเชื่อมต่อ
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">รายการเพลงของคุณ</h2>
              <button onClick={clearApiKey} className="text-xs text-neutral-400 hover:text-white underline">
                เปลี่ยน API Key
              </button>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p>กำลังโหลดเพลง...</p>
              </div>
            )}

            {error && !loading && (
              <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-xl flex items-start gap-3 text-red-200">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && files.length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <Music size={48} className="mx-auto mb-4 opacity-20" />
                <p>ไม่พบไฟล์ MP3 ในโฟลเดอร์นี้</p>
              </div>
            )}

            <div className="space-y-2 overflow-y-auto pb-4 custom-scrollbar">
              {files.map((file, index) => (
                <button
                  key={file.id}
                  onClick={() => playTrack(index)}
                  className={`w-full text-left p-4 rounded-xl flex items-center gap-4 transition-all ${
                    currentTrackIndex === index 
                      ? 'bg-green-500/20 border border-green-500/30' 
                      : 'bg-neutral-800 hover:bg-neutral-700 border border-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${currentTrackIndex === index ? 'bg-green-500 text-black' : 'bg-neutral-700 text-neutral-400'}`}>
                    {currentTrackIndex === index && isPlaying ? <Loader2 size={18} className="animate-spin" /> : <Music size={18} />}
                  </div>
                  <div className="overflow-hidden">
                    <p className={`font-medium truncate ${currentTrackIndex === index ? 'text-green-400' : 'text-white'}`}>
                      {file.name.replace(/\.mp3$/i, '')}
                    </p>
                    <p className="text-xs text-neutral-500 truncate mt-1">Google Drive Audio</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Player Bar (Fixed at bottom) */}
      {isKeySaved && files.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 pb-safe backdrop-blur-lg bg-opacity-90">
          <div className="max-w-lg mx-auto">
            {/* Audio Element (Hidden) */}
            {currentTrackIndex >= 0 && (
              <audio
                ref={audioRef}
                src={getStreamUrl(files[currentTrackIndex].id)}
                autoPlay={isPlaying}
              />
            )}

            {/* Progress Bar */}
            <div className="flex items-center gap-3 mb-4 text-xs font-medium text-neutral-400">
              <span>{formatTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={progress}
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <span>{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-4">
              <div className="w-1/3 truncate">
                <p className="text-sm font-semibold text-white truncate">
                  {currentTrackIndex >= 0 ? files[currentTrackIndex].name.replace(/\.mp3$/i, '') : 'เลือกเพลง...'}
                </p>
              </div>
              
              <div className="flex items-center gap-4 justify-center w-1/3">
                <button 
                  onClick={toggleShuffle} 
                  className={`transition-colors p-2 rounded-full ${isShuffle ? 'text-green-500 bg-green-500/10' : 'text-neutral-400 hover:text-white'}`}
                  title="สุ่มเพลง"
                >
                  <Shuffle size={20} />
                </button>
                <button onClick={playPrev} className="text-neutral-400 hover:text-white transition-colors">
                  <SkipBack size={24} fill="currentColor" />
                </button>
                <button 
                  onClick={togglePlay} 
                  className="w-14 h-14 bg-green-500 hover:bg-green-400 text-black rounded-full flex items-center justify-center transition-transform hover:scale-105 shrink-0"
                >
                  {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={playNext} className="text-neutral-400 hover:text-white transition-colors">
                  <SkipForward size={24} fill="currentColor" />
                </button>
              </div>

              <div className="w-1/3"></div> {/* Spacer for balance */}
            </div>
          </div>
        </div>
      )}

      {/* Basic Styles for Range Slider Customization */}
      <style dangerouslySetInnerHTML={{__html: `
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #22c55e;
          cursor: pointer;
        }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1rem); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #404040; border-radius: 4px; }
      `}} />
    </div>
  );
}