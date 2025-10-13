import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { tmdbApi, Genre, WatchProvider } from "@/lib/tmdb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterOptions {
  genres: number[];
  platforms: number[];
  language: string;
  year: number | null;
}

interface FilterBarProps {
  mediaType: "movie" | "tv";
  onFilterChange: (filters: FilterOptions) => void;
  className?: string;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "ml", name: "Malayalam" },
  { code: "kn", name: "Kannada" },
  { code: "bn", name: "Bengali" },
  { code: "pa", name: "Punjabi" },
];

const POPULAR_PLATFORMS = [
  { id: 8, name: "Netflix" },
  { id: 119, name: "Amazon Prime Video" },
  { id: 337, name: "Disney+ Hotstar" },
  { id: 531, name: "Jio Cinema" },
  { id: 175, name: "Netflix Kids" },
  { id: 283, name: "Crunchyroll" },
  { id: 350, name: "Apple TV Plus" },
  { id: 384, name: "HBO Max" },
];

export const FilterBar = ({ mediaType, onFilterChange, className }: FilterBarProps) => {
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<number[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: genresData } = useQuery({
    queryKey: ["genres", mediaType],
    queryFn: () => mediaType === "movie" ? tmdbApi.getMovieGenres() : tmdbApi.getTVGenres(),
  });

  const genres = genresData?.genres || [];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  useEffect(() => {
    onFilterChange({
      genres: selectedGenres,
      platforms: selectedPlatforms,
      language: selectedLanguage,
      year: selectedYear,
    });
  }, [selectedGenres, selectedPlatforms, selectedLanguage, selectedYear, onFilterChange]);

  const toggleGenre = (genreId: number) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const togglePlatform = (platformId: number) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((id) => id !== platformId) : [...prev, platformId]
    );
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedPlatforms([]);
    setSelectedLanguage("");
    setSelectedYear(null);
  };

  const hasActiveFilters =
    selectedGenres.length > 0 ||
    selectedPlatforms.length > 0 ||
    selectedLanguage !== "" ||
    selectedYear !== null;

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {/* Genre Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Genre
            {selectedGenres.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {selectedGenres.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <ScrollArea className="h-72">
            <div className="space-y-2 p-1">
              {genres.map((genre) => (
                <div key={genre.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`genre-${genre.id}`}
                    checked={selectedGenres.includes(genre.id)}
                    onCheckedChange={() => toggleGenre(genre.id)}
                  />
                  <Label htmlFor={`genre-${genre.id}`} className="cursor-pointer">
                    {genre.name}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Platform Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Platform
            {selectedPlatforms.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {selectedPlatforms.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <ScrollArea className="h-72">
            <div className="space-y-2 p-1">
              {POPULAR_PLATFORMS.map((platform) => (
                <div key={platform.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`platform-${platform.id}`}
                    checked={selectedPlatforms.includes(platform.id)}
                    onCheckedChange={() => togglePlatform(platform.id)}
                  />
                  <Label htmlFor={`platform-${platform.id}`} className="cursor-pointer">
                    {platform.name}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Language Filter */}
      <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value=" ">All Languages</SelectItem>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Year Filter */}
      <Select value={selectedYear?.toString() || ""} onValueChange={(val) => setSelectedYear(val ? parseInt(val) : null)}>
        <SelectTrigger className="w-[120px] h-9">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value=" ">All Years</SelectItem>
          {years.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
};
