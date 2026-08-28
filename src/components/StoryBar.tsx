import React from "react";
import { StoryItem } from "./StoryViewer";
import { Plus } from "lucide-react";

interface StoryBarProps {
  stories: StoryItem[];
  onStoryClick: (index: number) => void;
  currentUser: { username: string; avatar_url: string } | null;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  stories,
  onStoryClick,
  currentUser
}) => {
  return (
    <div className="flex gap-4 overflow-x-auto py-3 bg-black border-b border-white/10 px-4 scrollbar-none items-center select-none">
      
      {/* Current User personal Story Bubble */}
      {currentUser && (
        <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group">
          <div className="relative">
            <div className="p-[2px] rounded-full border border-white/20">
              <img 
                src={currentUser.avatar_url} 
                alt="Your story" 
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover p-0.5 bg-black" 
              />
            </div>
            <span className="absolute bottom-0 right-0 bg-[#0095F6] text-white rounded-full h-5 w-5 border-2 border-black flex items-center justify-center font-bold text-xs select-none shadow-md">
              <Plus className="h-3.5 w-3.5 stroke-[3]" />
            </span>
          </div>
          <span className="text-[11px] font-normal text-white/90 max-w-[70px] truncate">Your story</span>
        </div>
      )}

      {/* Stories list */}
      {stories.map((story, idx) => (
        <div 
          key={idx} 
          onClick={() => onStoryClick(idx)}
          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
        >
          {/* Unviewed Story status glowing blue gradient ring */}
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#0095F6] via-[#00D2FF] to-[#0066FF] active:scale-95 transition-transform">
            <div className="bg-black rounded-full p-[2px]">
              <img 
                src={story.avatar} 
                alt={story.username} 
                referrerPolicy="no-referrer"
                className="w-13 h-13 rounded-full object-cover" 
              />
            </div>
          </div>
          <span className="text-[11px] font-normal text-white/90 max-w-[70px] truncate">
            {story.username}
          </span>
        </div>
      ))}
    </div>
  );
};
