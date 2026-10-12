ALTER TABLE public.products ADD COLUMN view_count integer NOT NULL DEFAULT 0, ADD COLUMN like_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.product_engagement (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  liked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, visitor_id)
);
GRANT ALL ON public.product_engagement TO service_role;
ALTER TABLE public.product_engagement ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_product_view(_product_id uuid, _visitor_id uuid)
RETURNS TABLE(view_count integer, like_count integer, liked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _inserted integer;
BEGIN
  PERFORM 1 FROM public.products p WHERE p.id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.product_engagement (product_id, visitor_id) VALUES (_product_id, _visitor_id)
  ON CONFLICT (product_id, visitor_id) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted > 0 THEN
    UPDATE public.products p SET view_count = p.view_count + 1 WHERE p.id = _product_id;
  END IF;
  RETURN QUERY SELECT p.view_count, p.like_count, e.liked FROM public.products p
    JOIN public.product_engagement e ON e.product_id = p.id AND e.visitor_id = _visitor_id
    WHERE p.id = _product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_product_like(_product_id uuid, _visitor_id uuid)
RETURNS TABLE(view_count integer, like_count integer, liked boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _previous boolean;
BEGIN
  PERFORM 1 FROM public.products p WHERE p.id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT e.liked INTO _previous FROM public.product_engagement e WHERE e.product_id = _product_id AND e.visitor_id = _visitor_id;
  IF _previous IS NULL THEN
    INSERT INTO public.product_engagement (product_id, visitor_id, liked) VALUES (_product_id, _visitor_id, true);
    UPDATE public.products p SET like_count = p.like_count + 1 WHERE p.id = _product_id;
  ELSE
    UPDATE public.product_engagement e SET liked = NOT _previous WHERE e.product_id = _product_id AND e.visitor_id = _visitor_id;
    UPDATE public.products p SET like_count = GREATEST(0, p.like_count + CASE WHEN _previous THEN -1 ELSE 1 END) WHERE p.id = _product_id;
  END IF;
  RETURN QUERY SELECT p.view_count, p.like_count, e.liked FROM public.products p
    JOIN public.product_engagement e ON e.product_id = p.id AND e.visitor_id = _visitor_id
    WHERE p.id = _product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_product_view(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_product_like(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_product_view(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_product_like(uuid, uuid) TO anon, authenticated, service_role;