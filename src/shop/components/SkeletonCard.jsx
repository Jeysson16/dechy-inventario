const SkeletonCard = () => {
  return (
    <div className="shop-card rounded-2xl p-3">
      <div className="shop-skeleton aspect-[4/5] w-full rounded-xl" />
      <div className="mt-3 space-y-2">
        <div className="shop-skeleton h-3 w-3/4 rounded" />
        <div className="shop-skeleton h-3 w-1/2 rounded" />
        <div className="shop-skeleton h-8 w-full rounded-lg" />
      </div>
    </div>
  );
};

export default SkeletonCard;
