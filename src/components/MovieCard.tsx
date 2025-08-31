import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { Movie, TVShow, getImageUrl, isMovie } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";

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
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1">
          <Star className="h-3 w-3 fill-rating-gold text-rating-gold" />
          <span className="text-xs font-medium text-foreground">
            {item.vote_average.toFixed(1)}
          </span>
        </div>

        {/* Media type badge */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-xs">
            {isMovie(item) ? 'Movie' : 'TV Show'}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1 mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-2">{year}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {item.overview}
        </p>
      </div>
    </Card>
  );
};