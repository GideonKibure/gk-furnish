ALTER TABLE public.product_engagement ADD COLUMN viewed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.record_product_view(_product_id uuid, _visitor_id uuid)
RETURNS TABLE(view_count integer, like_count integer, liked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _previous boolean;
BEGIN
  PERFORM 1 FROM public.products p WHERE p.id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT e.viewed INTO _previous FROM public.product_engagement e WHERE e.product_id = _product_id AND e.visitor_id = _visitor_id;
  IF _previous IS NULL THEN
    INSERT INTO public.product_engagement (product_id, visitor_id, viewed) VALUES (_product_id, _visitor_id, true);
    UPDATE public.products p SET view_count = p.view_count + 1 WHERE p.id = _product_id;
  ELSIF NOT _previous THEN
    UPDATE public.product_engagement e SET viewed = true WHERE e.product_id = _product_id AND e.visitor_id = _visitor_id;
    UPDATE public.products p SET view_count = p.view_count + 1 WHERE p.id = _product_id;
  END IF;
  RETURN QUERY SELECT p.view_count, p.like_count, e.liked FROM public.products p
    JOIN public.product_engagement e ON e.product_id = p.id AND e.visitor_id = _visitor_id
    WHERE p.id = _product_id;
END;
$$;