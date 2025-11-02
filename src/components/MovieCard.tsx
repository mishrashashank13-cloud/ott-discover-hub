import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { Movie, TVShow, getImageUrl, isMovie } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";
import { RemindMeButton } from "@/components/RemindMeButton";

interface MovieCardProps {
  item: Movie | TVShow;
  className?: string;
}

export const MovieCard = ({ item, className }: MovieCardProps) => {
  const navigate = useNavigate();
  const title = isMovie(item) ? item.title : item.name;
  const releaseDate = isMovie(item) ? item.release_date : item.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
  const type = isMovie(item) ? 'movie' : 'tv';

  const handleClick = () => {
    navigate(`/${type}/${item.id}`);
  };

  return (
    <Card 
      className={`group cursor-pointer overflow-hidden border-border bg-card hover:bg-card-hover transition-all duration-300 hover:scale-105 hover:shadow-xl ${className}`}
      onClick={handleClick}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={getImageUrl(item.poster_path, 'w500')}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Rating badge */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5">
          <Star className="h-2.5 w-2.5 fill-rating-gold text-rating-gold" />
          <span className="text-[10px] font-medium text-foreground">
            {item.vote_average.toFixed(1)}
          </span>
        </div>

        {/* Media type badge */}
        <div className="absolute top-1.5 left-1.5">
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {isMovie(item) ? 'Movie' : 'TV Show'}
          </Badge>
        </div>
      </div>

      <div className="p-2">
        <h3 className="font-semibold text-xs text-foreground line-clamp-1 mb-0.5">{title}</h3>
        <p className="text-[10px] text-muted-foreground mb-1.5">{year}</p>
        <RemindMeButton
          contentId={item.id.toString()}
          contentTitle={title}
          contentType={type}
          releaseDate={releaseDate}
          variant="outline"
          size="sm"
          className="w-full text-[10px] h-6"
        />
      </div>
    </Card>
  );
};